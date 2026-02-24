package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"agent-workflow/backend/claude"
	"agent-workflow/backend/config"
	"agent-workflow/backend/models"
	"agent-workflow/backend/services"
	"agent-workflow/backend/store"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx context.Context
	cfg *config.Config

	// Stores
	db         *store.DB
	projects   *store.ProjectStore
	agents     *store.AgentStore
	teams      *store.TeamStore
	tasks      *store.TaskStore
	sessions   *store.SessionStore
	mcpServers *store.MCPServerStore

	// Services
	projectMgr  *services.ProjectManager
	runner      *services.AgentRunner
	taskEngine  *services.TaskEngine
	sessionMgr  *services.SessionManager
	diffTracker *services.DiffTracker
	testRunner  *services.TestRunner
	planner         *services.Planner
	promptImprover  *services.PromptImprover
	projectSetup    *services.ProjectSetup
	mcpCatalog      *services.MCPCatalog
}

func NewApp() *App {
	return &App{}
}

func (a *App) shutdown(ctx context.Context) {
	log.Println("Shutting down: stopping all running processes...")

	// Stop all running Claude processes
	if a.runner != nil {
		a.runner.StopAll()
	}

	// Cancel all running sessions
	if a.taskEngine != nil {
		a.taskEngine.StopAllSessions()
	}

	// Close database
	if a.db != nil {
		a.db.Close()
	}

	log.Println("Shutdown complete")
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	cfg, err := config.Load()
	if err != nil {
		log.Printf("config load error: %v, using defaults", err)
		cfg = config.DefaultConfig()
	}
	a.cfg = cfg

	db, err := store.NewDB(cfg.DataDir)
	if err != nil {
		log.Fatalf("database init error: %v", err)
	}
	a.db = db

	// Init stores
	a.projects = store.NewProjectStore(db)
	a.agents = store.NewAgentStore(db)
	a.teams = store.NewTeamStore(db)
	a.tasks = store.NewTaskStore(db)
	a.sessions = store.NewSessionStore(db)
	a.mcpServers = store.NewMCPServerStore(db)

	// Init services
	a.projectMgr = services.NewProjectManager(cfg.WorkspacePath)
	a.runner = services.NewAgentRunner(cfg.ClaudeCLIPath)
	a.runner.SetWailsContext(ctx)
	a.diffTracker = services.NewDiffTracker()
	a.testRunner = services.NewTestRunner()
	a.taskEngine = services.NewTaskEngine(a.tasks, a.sessions, a.agents, a.projects, a.mcpServers, a.teams, a.projectMgr, a.runner, a.diffTracker, a.testRunner)
	a.taskEngine.SetWailsContext(ctx)
	a.sessionMgr = services.NewSessionManager(a.sessions, a.tasks, a.projectMgr)
	a.planner = services.NewPlanner()
	a.promptImprover = services.NewPromptImprover()
	a.projectSetup = services.NewProjectSetup()
	a.projectSetup.SetWailsContext(ctx)
	a.mcpCatalog = services.NewMCPCatalog()
}

// ─── Config ────────────────────────────────────────────

func (a *App) GetConfig() *config.Config {
	return a.cfg
}

func (a *App) UpdateConfig(cfg config.Config) error {
	a.cfg = &cfg
	return a.cfg.Save()
}

// ─── Project ───────────────────────────────────────────

func (a *App) ListProjects() ([]models.Project, error) {
	return a.projects.List()
}

func (a *App) CreateProject(p models.Project) (*models.Project, error) {
	if err := a.projects.Create(&p); err != nil {
		return nil, err
	}
	return &p, nil
}

func (a *App) UpdateProject(p models.Project) error {
	return a.projects.Update(&p)
}

func (a *App) DeleteProject(id string) error {
	return a.projects.Delete(id)
}

func (a *App) SelectProjectFolder() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Project Folder",
	})
}

// ─── Project Setup ─────────────────────────────────────

func (a *App) CheckProjectSetup(path string) (*services.ProjectSetupStatus, error) {
	return a.projectSetup.CheckStatus(path)
}

func (a *App) RunProjectSetup(path string, action services.SetupAction) error {
	return a.projectSetup.RunSetup(path, action)
}

// ─── Agent ─────────────────────────────────────────────

func (a *App) ListAgents() ([]models.Agent, error) {
	return a.agents.List()
}

func (a *App) GetAgent(id string) (*models.Agent, error) {
	return a.agents.GetByID(id)
}

func (a *App) CreateAgent(agent models.Agent) (*models.Agent, error) {
	if err := a.agents.Create(&agent); err != nil {
		return nil, err
	}
	return &agent, nil
}

func (a *App) UpdateAgent(agent models.Agent) error {
	return a.agents.Update(&agent)
}

func (a *App) DeleteAgent(id string) error {
	return a.agents.Delete(id)
}

// ─── MCP Servers ──────────────────────────────────────

func (a *App) ListMCPServers() ([]models.MCPServer, error) {
	return a.mcpServers.List()
}

func (a *App) GetMCPServer(id string) (*models.MCPServer, error) {
	return a.mcpServers.GetByID(id)
}

func (a *App) CreateMCPServer(server models.MCPServer) (*models.MCPServer, error) {
	if err := a.mcpServers.Create(&server); err != nil {
		return nil, err
	}
	return &server, nil
}

func (a *App) UpdateMCPServer(server models.MCPServer) error {
	return a.mcpServers.Update(&server)
}

func (a *App) DeleteMCPServer(id string) error {
	return a.mcpServers.Delete(id)
}

// ─── MCP Catalog (Smithery Registry) ──────────────────

func (a *App) SearchMCPCatalog(query string, page int) (*services.CatalogResponse, error) {
	return a.mcpCatalog.Search(query, page)
}

func (a *App) GetMCPInstallConfig(qualifiedName string) *services.InstallConfig {
	return a.mcpCatalog.GetInstallConfig(qualifiedName)
}

// ─── Team ──────────────────────────────────────────────

func (a *App) ListTeams() ([]models.Team, error) {
	return a.teams.List()
}

func (a *App) GetTeam(id string) (*models.Team, error) {
	return a.teams.GetByID(id)
}

func (a *App) CreateTeam(team models.Team) (*models.Team, error) {
	if err := a.teams.Create(&team); err != nil {
		return nil, err
	}
	return &team, nil
}

func (a *App) UpdateTeam(team models.Team) error {
	return a.teams.Update(&team)
}

func (a *App) DeleteTeam(id string) error {
	return a.teams.Delete(id)
}

// ─── Session ───────────────────────────────────────────

func (a *App) ListSessions() ([]models.Session, error) {
	return a.sessions.List()
}

func (a *App) GetSession(id string) (*models.Session, error) {
	return a.sessions.GetByID(id)
}

func (a *App) CreateSession(sess models.Session) (*models.Session, error) {
	if err := a.sessions.Create(&sess); err != nil {
		return nil, err
	}
	return &sess, nil
}

func (a *App) ListSessionsByProject(projectID string) ([]models.Session, error) {
	return a.sessions.ListByProject(projectID)
}

func (a *App) DeleteSession(id string) error {
	// Cleanup workspaces when deleting a session
	a.projectMgr.CleanupSession(id)
	return a.sessions.Delete(id)
}

// ─── Task ──────────────────────────────────────────────

func (a *App) ListTasks(sessionID string) ([]models.Task, error) {
	return a.tasks.ListBySession(sessionID)
}

func (a *App) GetTask(id string) (*models.Task, error) {
	return a.tasks.GetByID(id)
}

func (a *App) CreateTask(task models.Task) (*models.Task, error) {
	if err := a.tasks.Create(&task); err != nil {
		return nil, err
	}
	return &task, nil
}

func (a *App) UpdateTask(task models.Task) error {
	return a.tasks.Update(&task)
}

func (a *App) DeleteTask(id string) error {
	return a.tasks.Delete(id)
}

// ─── Execution ─────────────────────────────────────────

func (a *App) StartSession(sessionID string) error {
	return a.taskEngine.StartSession(sessionID)
}

func (a *App) StopSession(sessionID string) error {
	return a.taskEngine.StopSession(sessionID)
}

func (a *App) StopTask(taskID string) error {
	return a.runner.StopTask(taskID)
}

func (a *App) GetTaskStreamEvents(taskID string) []claude.TaskStreamEvent {
	return a.runner.GetTaskEvents(taskID)
}

func (a *App) GetSessionStreamEvents(sessionID string) (map[string][]claude.TaskStreamEvent, error) {
	tasks, err := a.tasks.ListBySession(sessionID)
	if err != nil {
		return nil, err
	}
	taskIDs := make([]string, len(tasks))
	for i, t := range tasks {
		taskIDs[i] = t.ID
	}
	return a.runner.GetSessionEvents(taskIDs), nil
}

func (a *App) ApplyTaskChanges(taskID string) error {
	task, err := a.tasks.GetByID(taskID)
	if err != nil {
		return err
	}
	session, err := a.sessions.GetByID(task.SessionID)
	if err != nil {
		return err
	}
	project, err := a.projects.GetByID(session.ProjectID)
	if err != nil {
		return err
	}
	return a.sessionMgr.ApplyTaskChanges(taskID, project.Path)
}

func (a *App) RejectTaskChanges(taskID string) error {
	return a.sessionMgr.RejectTaskChanges(taskID)
}

func (a *App) GetTaskDiff(taskID string) (*services.DiffResult, error) {
	task, err := a.tasks.GetByID(taskID)
	if err != nil {
		return nil, err
	}
	if task.WorkspacePath == "" {
		return &services.DiffResult{}, nil
	}
	session, err := a.sessions.GetByID(task.SessionID)
	if err != nil {
		return nil, err
	}
	project, err := a.projects.GetByID(session.ProjectID)
	if err != nil {
		return nil, err
	}
	return a.diffTracker.ComputeDiff(project.Path, task.WorkspacePath)
}

// ─── Hunk Operations ─────────────────────────────────

// AcceptHunk applies a single hunk from the workspace to the project.
func (a *App) AcceptHunk(taskID string, filePath string, hunkIndex int) error {
	task, err := a.tasks.GetByID(taskID)
	if err != nil {
		return err
	}
	if task.WorkspacePath == "" {
		return fmt.Errorf("task has no workspace")
	}
	session, err := a.sessions.GetByID(task.SessionID)
	if err != nil {
		return err
	}
	project, err := a.projects.GetByID(session.ProjectID)
	if err != nil {
		return err
	}

	diffResult, err := a.diffTracker.ComputeDiff(project.Path, task.WorkspacePath)
	if err != nil {
		return err
	}

	for _, f := range diffResult.Files {
		if f.Path == filePath {
			if hunkIndex < 0 || hunkIndex >= len(f.Hunks) {
				return fmt.Errorf("hunk index %d out of range (file has %d hunks)", hunkIndex, len(f.Hunks))
			}
			return a.diffTracker.ApplyHunk(project.Path, filePath, f.Hunks[hunkIndex], project.Path)
		}
	}
	return fmt.Errorf("file %s not found in diff", filePath)
}

// RejectHunk reverts a hunk in workspace and optionally sends explanation to Claude.
func (a *App) RejectHunk(taskID string, filePath string, hunkIndex int, reason string) error {
	task, err := a.tasks.GetByID(taskID)
	if err != nil {
		return err
	}
	if task.WorkspacePath == "" {
		return fmt.Errorf("task has no workspace")
	}
	session, err := a.sessions.GetByID(task.SessionID)
	if err != nil {
		return err
	}
	project, err := a.projects.GetByID(session.ProjectID)
	if err != nil {
		return err
	}

	diffResult, err := a.diffTracker.ComputeDiff(project.Path, task.WorkspacePath)
	if err != nil {
		return err
	}

	var targetHunk *services.DiffHunk
	for _, f := range diffResult.Files {
		if f.Path == filePath && hunkIndex >= 0 && hunkIndex < len(f.Hunks) {
			h := f.Hunks[hunkIndex]
			targetHunk = &h
			break
		}
	}
	if targetHunk == nil {
		return fmt.Errorf("hunk not found")
	}

	if err := a.diffTracker.RevertHunk(task.WorkspacePath, filePath, *targetHunk, project.Path); err != nil {
		return fmt.Errorf("revert hunk: %w", err)
	}

	if reason != "" && task.ClaudeSessionID != "" {
		followUpMsg := fmt.Sprintf(
			"The following change in %s was reverted:\n```diff\n%s\n%s\n```\nReason: %s\nPlease adjust your approach accordingly.",
			filePath, targetHunk.Header, targetHunk.Content, reason,
		)
		return a.taskEngine.SendFollowUp(taskID, followUpMsg, "code")
	}

	return nil
}

// AcceptFile applies all changes from a file in workspace to the project.
func (a *App) AcceptFile(taskID string, filePath string) error {
	task, err := a.tasks.GetByID(taskID)
	if err != nil {
		return err
	}
	session, err := a.sessions.GetByID(task.SessionID)
	if err != nil {
		return err
	}
	project, err := a.projects.GetByID(session.ProjectID)
	if err != nil {
		return err
	}
	return a.sessionMgr.ApplySpecificFiles(taskID, project.Path, []string{filePath})
}

// RejectFile reverts an entire file in workspace and optionally tells Claude.
func (a *App) RejectFile(taskID string, filePath string, reason string) error {
	task, err := a.tasks.GetByID(taskID)
	if err != nil {
		return err
	}
	if task.WorkspacePath == "" {
		return fmt.Errorf("task has no workspace")
	}
	session, err := a.sessions.GetByID(task.SessionID)
	if err != nil {
		return err
	}
	project, err := a.projects.GetByID(session.ProjectID)
	if err != nil {
		return err
	}

	if err := a.diffTracker.RevertFile(task.WorkspacePath, filePath, project.Path); err != nil {
		return err
	}

	if reason != "" && task.ClaudeSessionID != "" {
		followUpMsg := fmt.Sprintf(
			"All changes to %s were reverted. Reason: %s\nPlease adjust your approach.",
			filePath, reason,
		)
		return a.taskEngine.SendFollowUp(taskID, followUpMsg, "code")
	}
	return nil
}

// SaveWorkspaceFile saves edited content to a file in the task workspace.
func (a *App) SaveWorkspaceFile(taskID string, filePath string, content string) error {
	task, err := a.tasks.GetByID(taskID)
	if err != nil {
		return err
	}
	if task.WorkspacePath == "" {
		return fmt.Errorf("task has no workspace")
	}
	fullPath := filepath.Join(task.WorkspacePath, filePath)
	return os.WriteFile(fullPath, []byte(content), 0644)
}

// ─── Follow-up & Chat ────────────────────────────────

func (a *App) SendFollowUp(taskID string, message string, mode string) error {
	return a.taskEngine.SendFollowUp(taskID, message, mode)
}

func (a *App) ReadProjectFile(taskID string, filePath string) (string, error) {
	task, err := a.tasks.GetByID(taskID)
	if err != nil {
		return "", err
	}

	// Use workspace if available, otherwise use project dir
	baseDir := task.WorkspacePath
	if baseDir == "" {
		session, err := a.sessions.GetByID(task.SessionID)
		if err != nil {
			return "", err
		}
		project, err := a.projects.GetByID(session.ProjectID)
		if err != nil {
			return "", err
		}
		baseDir = project.Path
	}

	fullPath := baseDir + "/" + filePath
	data, err := os.ReadFile(fullPath)
	if err != nil {
		return "", fmt.Errorf("read file: %w", err)
	}
	// Limit to 100KB to avoid huge responses
	if len(data) > 100*1024 {
		data = data[:100*1024]
	}
	return string(data), nil
}

func (a *App) ListProjectFiles(taskID string) ([]string, error) {
	task, err := a.tasks.GetByID(taskID)
	if err != nil {
		return nil, err
	}

	baseDir := task.WorkspacePath
	if baseDir == "" {
		session, err := a.sessions.GetByID(task.SessionID)
		if err != nil {
			return nil, err
		}
		project, err := a.projects.GetByID(session.ProjectID)
		if err != nil {
			return nil, err
		}
		baseDir = project.Path
	}

	var files []string
	err = filepath.Walk(baseDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // skip errors
		}
		// Skip hidden dirs and common noise
		name := info.Name()
		if info.IsDir() && (name == ".git" || name == "node_modules" || name == ".next" || name == "__pycache__" || name == "vendor" || name == ".venv") {
			return filepath.SkipDir
		}
		if !info.IsDir() {
			rel, _ := filepath.Rel(baseDir, path)
			files = append(files, rel)
		}
		return nil
	})
	return files, err
}

// ─── Planner ──────────────────────────────────────────

func (a *App) PlanTasks(projectID string, goal string) (*services.PlanResult, error) {
	project, err := a.projects.GetByID(projectID)
	if err != nil {
		return nil, err
	}
	agents, _ := a.agents.List()
	return a.planner.PlanTasks(a.ctx, project.Path, goal, agents)
}

// ─── Prompt Improver ──────────────────────────────────

func (a *App) ImprovePrompt(draft string, agentName string, agentDescription string) (*services.PromptImproveResult, error) {
	return a.promptImprover.ImprovePrompt(a.ctx, draft, agentName, agentDescription)
}

// ─── Workspace Cleanup ────────────────────────────────

func (a *App) CleanupSessionWorkspaces(sessionID string) error {
	return a.projectMgr.CleanupSession(sessionID)
}

func (a *App) CleanupAllWorkspaces() error {
	sessions, err := a.sessions.List()
	if err != nil {
		return err
	}
	for _, sess := range sessions {
		if sess.Status == models.SessionStatusCompleted || sess.Status == models.SessionStatusFailed {
			a.projectMgr.CleanupSession(sess.ID)
		}
	}
	return nil
}

// ─── Stats ─────────────────────────────────────────────

type DashboardStats struct {
	ProjectCount int `json:"project_count"`
	AgentCount   int `json:"agent_count"`
	TeamCount    int `json:"team_count"`
	SessionCount int `json:"session_count"`
	RunningTasks int `json:"running_tasks"`
}

func (a *App) GetDashboardStats() (*DashboardStats, error) {
	var projectCount, agentCount, teamCount, sessionCount int64
	a.db.Model(&models.Project{}).Count(&projectCount)
	a.db.Model(&models.Agent{}).Count(&agentCount)
	a.db.Model(&models.Team{}).Count(&teamCount)
	a.db.Model(&models.Session{}).Count(&sessionCount)

	return &DashboardStats{
		ProjectCount: int(projectCount),
		AgentCount:   int(agentCount),
		TeamCount:    int(teamCount),
		SessionCount: int(sessionCount),
		RunningTasks: a.runner.RunningCount(),
	}, nil
}

// SessionStats returns aggregate statistics for a specific session.
type SessionStats struct {
	TotalTasks     int `json:"total_tasks"`
	CompletedTasks int `json:"completed_tasks"`
	FailedTasks    int `json:"failed_tasks"`
	RunningTasks   int `json:"running_tasks"`
	PendingTasks   int `json:"pending_tasks"`
}

func (a *App) GetSessionStats(sessionID string) (*SessionStats, error) {
	tasks, err := a.tasks.ListBySession(sessionID)
	if err != nil {
		return nil, err
	}

	stats := &SessionStats{}
	for _, t := range tasks {
		stats.TotalTasks++
		switch t.Status {
		case models.TaskStatusCompleted:
			stats.CompletedTasks++
		case models.TaskStatusFailed:
			stats.FailedTasks++
		case models.TaskStatusRunning:
			stats.RunningTasks++
		case models.TaskStatusPending, models.TaskStatusQueued:
			stats.PendingTasks++
		}
	}
	return stats, nil
}
