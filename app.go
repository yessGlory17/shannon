package main

import (
	"context"
	"encoding/json"
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
	mcpCatalog      *services.MCPCatalog
	mcpHealth       *services.MCPHealthChecker
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
	a.mcpCatalog = services.NewMCPCatalog()
	a.mcpHealth = services.NewMCPHealthChecker()
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
		Title: "Select Workspace Folder",
	})
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

// SeedExampleAgents creates pre-configured example agents that use
// the currently installed MCP servers. It auto-detects which MCP servers
// exist and creates appropriate agents for them.
func (a *App) SeedExampleAgents() ([]models.Agent, error) {
	servers, err := a.mcpServers.List()
	if err != nil {
		return nil, fmt.Errorf("list MCP servers: %w", err)
	}

	// Build server_key -> ID lookup for enabled servers
	keyToID := make(map[string]string)
	for _, s := range servers {
		if s.Enabled {
			keyToID[s.ServerKey] = s.ID
		}
	}

	// Collect all MCP server IDs
	allIDs := make(models.StringSlice, 0, len(keyToID))
	for _, id := range keyToID {
		allIDs = append(allIDs, id)
	}

	// Template agents based on available MCP servers
	type agentTemplate struct {
		Name         string
		Description  string
		Model        string
		SystemPrompt string
		AllowedTools models.StringSlice
		MCPKeys      []string // MCP server keys this agent should use
		Permissions  string
	}

	templates := []agentTemplate{
		{
			Name:        "Full-Stack Developer",
			Description: "A senior developer agent with access to all configured MCP tools. Can read/write code, run commands, browse the web, and interact with external services via MCP.",
			Model:       "sonnet",
			SystemPrompt: `You are a senior full-stack developer. You have access to MCP tools that let you interact with external services.

Use MCP tools proactively when they can help accomplish the task:
- If a GitLab/GitHub MCP is available, use it to read issues, create merge requests, review code, etc.
- If a Playwright MCP is available, use it to test web applications in a real browser.
- If a filesystem or database MCP is available, use it to explore and modify data.

Always write clean, well-structured code. Follow existing project conventions.
When making changes, verify they work by running tests or checking the output.`,
			AllowedTools: models.StringSlice{"Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebFetch", "Task", "NotebookEdit"},
			MCPKeys:      nil, // will use ALL available MCP servers
			Permissions:  "acceptEdits",
		},
	}

	// Add GitLab-specific agent if gitlab server exists
	if _, ok := keyToID["gitlab"]; ok {
		templates = append(templates, agentTemplate{
			Name:        "GitLab Assistant",
			Description: "Specialized for GitLab operations: issues, merge requests, code reviews, and CI/CD pipelines via MCP.",
			Model:       "sonnet",
			SystemPrompt: `You are a GitLab operations specialist. You have access to the GitLab MCP server which lets you interact with GitLab directly.

Your capabilities via MCP:
- List, read, and create issues
- Create and review merge requests
- Browse repository files and branches
- Manage CI/CD pipelines
- Search across projects

When given a task:
1. Use the GitLab MCP tools to gather context (read issues, check existing MRs, etc.)
2. Make code changes if needed using file tools
3. Create merge requests or update issues via MCP
4. Always provide clear descriptions and link related issues.`,
			AllowedTools: models.StringSlice{"Bash", "Read", "Write", "Edit", "Glob", "Grep"},
			MCPKeys:      []string{"gitlab"},
			Permissions:  "acceptEdits",
		})
	}

	// Add Playwright-specific agent if playwright server exists
	for _, key := range []string{"playwright-mcp", "playwright"} {
		if _, ok := keyToID[key]; ok {
			templates = append(templates, agentTemplate{
				Name:        "QA Test Engineer",
				Description: "Automated testing agent using Playwright MCP for browser-based testing, screenshot capture, and web interaction.",
				Model:       "us.anthropic.claude-opus-4-1-20250805-v1:0",
				SystemPrompt: `You are a QA test engineer with access to Playwright MCP for browser automation.

Your capabilities via MCP:
- Navigate to web pages and take screenshots
- Click buttons, fill forms, and interact with web elements
- Assert page content and verify UI behavior
- Run end-to-end test scenarios in a real browser

When given a testing task:
1. Plan the test steps
2. Use Playwright MCP to navigate to the target page
3. Interact with the page elements as needed
4. Take screenshots to document the results
5. Report pass/fail with evidence

Write test results clearly and include screenshots when relevant.`,
				AllowedTools: models.StringSlice{"Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebFetch"},
				MCPKeys:      []string{key},
				Permissions:  "bypassPermissions",
			})
			break
		}
	}

	// Create the agents
	var created []models.Agent
	for _, tmpl := range templates {
		agent := models.Agent{
			Name:         tmpl.Name,
			Description:  tmpl.Description,
			Model:        tmpl.Model,
			SystemPrompt: tmpl.SystemPrompt,
			AllowedTools: tmpl.AllowedTools,
			Permissions:  tmpl.Permissions,
		}

		// Assign MCP server IDs
		if tmpl.MCPKeys == nil {
			// Use all available MCP servers
			agent.MCPServerIDs = allIDs
		} else {
			ids := make(models.StringSlice, 0)
			for _, key := range tmpl.MCPKeys {
				if id, ok := keyToID[key]; ok {
					ids = append(ids, id)
				}
			}
			agent.MCPServerIDs = ids
		}

		if err := a.agents.Create(&agent); err != nil {
			return nil, fmt.Errorf("create agent %q: %w", tmpl.Name, err)
		}
		created = append(created, agent)
	}

	return created, nil
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

// ─── MCP Health Check ─────────────────────────────────

func (a *App) TestMCPServer(command string, args []string, env map[string]string) *services.MCPHealthResult {
	return a.mcpHealth.Check(command, args, env)
}

// ─── MCP JSON Import ──────────────────────────────────

func (a *App) ParseMCPJson(jsonStr string) ([]services.MCPJsonImportEntry, error) {
	return a.mcpCatalog.ParseMCPJson(jsonStr)
}

// ─── MCP Import from Claude CLI ──────────────────────

// ImportMCPFromClaude reads ~/.claude.json and collects mcpServers from both
// top-level and per-project scopes, then imports them into the DB.
// Returns the JSON string of the imported servers in .mcp.json format.
func (a *App) ImportMCPFromClaude() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("get home dir: %w", err)
	}

	claudeConfigPath := filepath.Join(home, ".claude.json")
	data, err := os.ReadFile(claudeConfigPath)
	if err != nil {
		return "", fmt.Errorf("read ~/.claude.json: %w", err)
	}

	// Claude Code stores MCP servers in:
	// - Top-level: {"mcpServers": {...}}
	// - Per-project: {"projects": {"/path": {"mcpServers": {...}}}}
	type claudeServerEntry struct {
		Type    string            `json:"type"`
		Command string            `json:"command"`
		Args    []string          `json:"args"`
		Env     map[string]string `json:"env"`
	}

	var claudeConfig struct {
		MCPServers map[string]claudeServerEntry            `json:"mcpServers"`
		Projects   map[string]struct {
			MCPServers map[string]claudeServerEntry `json:"mcpServers"`
		} `json:"projects"`
	}

	if err := json.Unmarshal(data, &claudeConfig); err != nil {
		return "", fmt.Errorf("parse ~/.claude.json: %w", err)
	}

	// Collect all MCP servers: top-level first, then per-project (later entries override)
	type mcpEntry struct {
		Command string            `json:"command"`
		Args    []string          `json:"args,omitempty"`
		Env     map[string]string `json:"env,omitempty"`
	}
	collected := make(map[string]mcpEntry)

	addServers := func(servers map[string]claudeServerEntry) {
		for key, srv := range servers {
			entry := mcpEntry{Command: srv.Command}
			if len(srv.Args) > 0 {
				entry.Args = srv.Args
			}
			if len(srv.Env) > 0 {
				entry.Env = srv.Env
			}
			collected[key] = entry
		}
	}

	// Top-level mcpServers
	addServers(claudeConfig.MCPServers)

	// Per-project mcpServers
	for _, proj := range claudeConfig.Projects {
		addServers(proj.MCPServers)
	}

	if len(collected) == 0 {
		return "", fmt.Errorf("no mcpServers found in ~/.claude.json")
	}

	mcpJson := struct {
		MCPServers map[string]mcpEntry `json:"mcpServers"`
	}{
		MCPServers: collected,
	}

	jsonBytes, err := json.MarshalIndent(mcpJson, "", "  ")
	if err != nil {
		return "", fmt.Errorf("marshal JSON: %w", err)
	}

	// Sync to DB
	jsonStr := string(jsonBytes)
	if err := a.SyncMCPFromJson(jsonStr); err != nil {
		return "", fmt.Errorf("sync to DB: %w", err)
	}

	log.Printf("Imported %d MCP server(s) from ~/.claude.json", len(collected))
	return jsonStr, nil
}

// ─── MCP JSON Sync ───────────────────────────────────

// SyncMCPFromJson takes a .mcp.json format string, parses it, and syncs the DB
// to match. New servers are created, existing ones updated, removed ones deleted.
func (a *App) SyncMCPFromJson(jsonStr string) error {
	entries, err := a.mcpCatalog.ParseMCPJson(jsonStr)
	if err != nil {
		return err
	}

	existing, err := a.mcpServers.List()
	if err != nil {
		return fmt.Errorf("list existing servers: %w", err)
	}

	// Build map of existing servers by server_key
	existingMap := make(map[string]models.MCPServer)
	for _, s := range existing {
		existingMap[s.ServerKey] = s
	}

	// Track which keys are in the new JSON
	newKeys := make(map[string]bool)

	for _, entry := range entries {
		newKeys[entry.ServerKey] = true

		if ex, ok := existingMap[entry.ServerKey]; ok {
			// Update existing
			ex.Command = entry.Command
			ex.Args = entry.Args
			if entry.Env != nil {
				ex.Env = entry.Env
			} else {
				ex.Env = make(map[string]string)
			}
			ex.Enabled = true
			if err := a.mcpServers.Update(&ex); err != nil {
				return fmt.Errorf("update server %s: %w", entry.ServerKey, err)
			}
		} else {
			// Create new
			env := entry.Env
			if env == nil {
				env = make(map[string]string)
			}
			srv := models.MCPServer{
				Name:      entry.ServerKey,
				ServerKey: entry.ServerKey,
				Command:   entry.Command,
				Args:      entry.Args,
				Env:       env,
				Enabled:   true,
			}
			if err := a.mcpServers.Create(&srv); err != nil {
				return fmt.Errorf("create server %s: %w", entry.ServerKey, err)
			}
		}
	}

	// Delete servers that are no longer in the JSON
	for key, ex := range existingMap {
		if !newKeys[key] {
			if err := a.mcpServers.Delete(ex.ID); err != nil {
				return fmt.Errorf("delete server %s: %w", key, err)
			}
		}
	}

	return nil
}

// ExportMCPJson exports all MCP servers from the DB as a .mcp.json format string.
func (a *App) ExportMCPJson() (string, error) {
	servers, err := a.mcpServers.List()
	if err != nil {
		return "", fmt.Errorf("list servers: %w", err)
	}

	type mcpEntry struct {
		Command string            `json:"command"`
		Args    []string          `json:"args,omitempty"`
		Env     map[string]string `json:"env,omitempty"`
	}

	mcpConfig := struct {
		MCPServers map[string]mcpEntry `json:"mcpServers"`
	}{
		MCPServers: make(map[string]mcpEntry),
	}

	for _, srv := range servers {
		entry := mcpEntry{
			Command: srv.Command,
		}
		if len(srv.Args) > 0 {
			entry.Args = srv.Args
		}
		if len(srv.Env) > 0 {
			entry.Env = srv.Env
		}
		mcpConfig.MCPServers[srv.ServerKey] = entry
	}

	data, err := json.MarshalIndent(mcpConfig, "", "  ")
	if err != nil {
		return "", fmt.Errorf("marshal JSON: %w", err)
	}

	return string(data), nil
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

func (a *App) CompleteSession(sessionID string) error {
	return a.taskEngine.CompleteSession(sessionID)
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
