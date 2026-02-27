package store

import (
	"agent-workflow/backend/models"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type DB struct {
	*gorm.DB
}

func NewDB(dataDir string) (*DB, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}

	dbPath := filepath.Join(dataDir, "agent-workflow.db")

	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	// Enable WAL mode for better concurrent read performance
	db.Exec("PRAGMA journal_mode=WAL")
	db.Exec("PRAGMA foreign_keys=ON")
	db.Exec("PRAGMA synchronous=NORMAL")
	db.Exec("PRAGMA cache_size=-64000") // 64MB cache
	db.Exec("PRAGMA busy_timeout=5000") // 5s busy timeout
	db.Exec("PRAGMA temp_store=MEMORY")
	db.Exec("PRAGMA mmap_size=268435456") // 256MB memory-mapped I/O

	// Configure connection pool for SQLite
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("get sql.DB: %w", err)
	}
	sqlDB.SetMaxOpenConns(5)
	sqlDB.SetMaxIdleConns(2)
	sqlDB.SetConnMaxLifetime(time.Hour)

	// Drop any partial indexes (WITH WHERE clause) from previous runs that
	// break GORM's AutoMigrate DDL parser. This must happen BEFORE AutoMigrate.
	cleanupStaleIndexes(db)

	if err := db.AutoMigrate(
		&models.Project{},
		&models.Agent{},
		&models.Team{},
		&models.Session{},
		&models.Task{},
		&models.MCPServer{},
	); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}

	// Create optimized indexes for dashboard queries (safe for existing DBs)
	createDashboardIndexes(db)

	// Run PRAGMA optimize after indexes are created (updates query planner stats)
	db.Exec("PRAGMA optimize")

	return &DB{db}, nil
}

// cleanupStaleIndexes drops custom indexes that were created by raw SQL in
// previous runs. GORM's SQLite migrator reads ALL index DDL from sqlite_master
// and cannot parse indexes created without backtick quoting or with WHERE
// clauses, causing "invalid DDL" errors during AutoMigrate.
// These are recreated properly after AutoMigrate by createDashboardIndexes.
func cleanupStaleIndexes(db *gorm.DB) {
	staleIndexes := []string{
		// Partial indexes from first version (had WHERE clauses)
		"idx_task_trend_covering",
		"idx_task_agent_perf",
		"idx_task_running",
		"idx_task_files_changed",
		"idx_task_team_count",
		// Raw SQL indexes that GORM can't parse (no backtick quoting)
		"idx_task_session_status_cover",
		"idx_task_session_test_build",
		"idx_task_agent_status",
		"idx_task_completed_status",
		"idx_task_agent_id",
		"idx_task_team_id",
		"idx_task_completed_at",
		"idx_task_test_passed",
		"idx_task_build_passed",
		"idx_session_status",
		"idx_session_created",
		"idx_agent_model",
		// Orphan indexes from previous GORM tag experiments
		"idx_task_session_created",
		"idx_task_status_completed",
	}
	for _, name := range staleIndexes {
		db.Exec("DROP INDEX IF EXISTS " + name)
	}
}

// createDashboardIndexes creates performance indexes using raw SQL.
// All use IF NOT EXISTS so they're safe to run on every startup.
// IMPORTANT: Only use simple indexes (no WHERE clauses) to avoid breaking
// GORM's AutoMigrate on subsequent startups.
func createDashboardIndexes(db *gorm.DB) {
	indexes := map[string]string{
		// Single-column indexes for frequently filtered columns
		"idx_task_agent_id":     `CREATE INDEX IF NOT EXISTS idx_task_agent_id ON tasks(agent_id)`,
		"idx_task_team_id":      `CREATE INDEX IF NOT EXISTS idx_task_team_id ON tasks(team_id)`,
		"idx_task_completed_at": `CREATE INDEX IF NOT EXISTS idx_task_completed_at ON tasks(completed_at)`,
		"idx_task_test_passed":  `CREATE INDEX IF NOT EXISTS idx_task_test_passed ON tasks(test_passed)`,
		"idx_task_build_passed": `CREATE INDEX IF NOT EXISTS idx_task_build_passed ON tasks(build_passed)`,
		"idx_session_status":    `CREATE INDEX IF NOT EXISTS idx_session_status ON sessions(status)`,
		"idx_session_created":   `CREATE INDEX IF NOT EXISTS idx_session_created ON sessions(created_at)`,
		"idx_agent_model":       `CREATE INDEX IF NOT EXISTS idx_agent_model ON agents(model)`,

		// Composite indexes for dashboard aggregation queries
		"idx_task_session_status_cover": `CREATE INDEX IF NOT EXISTS idx_task_session_status_cover ON tasks(session_id, status)`,
		"idx_task_session_test_build":   `CREATE INDEX IF NOT EXISTS idx_task_session_test_build ON tasks(session_id, test_passed, build_passed)`,
		"idx_task_agent_status":         `CREATE INDEX IF NOT EXISTS idx_task_agent_status ON tasks(agent_id, status)`,
		"idx_task_completed_status":     `CREATE INDEX IF NOT EXISTS idx_task_completed_status ON tasks(completed_at, status)`,
	}

	for name, ddl := range indexes {
		if err := db.Exec(ddl).Error; err != nil {
			log.Printf("warning: failed to create index %s: %v", name, err)
		}
	}
}

// Close closes the underlying database connection.
func (d *DB) Close() error {
	sqlDB, err := d.DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
