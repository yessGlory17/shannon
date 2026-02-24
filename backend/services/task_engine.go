package services

import (
	"agent-workflow/backend/models"
	"agent-workflow/backend/store"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// TaskEngine orchestrates task execution with dependency resolution and parallel dispatch.
type TaskEngine struct {
	tasks      *store.TaskStore
	sessions   *store.SessionStore
	agents     *store.AgentStore
	projects   *store.ProjectStore
	mcpServers *store.MCPServerStore
	teams      *store.TeamStore
	projectMgr *ProjectManager
	runner     *AgentRunner
	diffTracker *DiffTracker
	testRunner *TestRunner

	cancelFuncs    map[string]context.CancelFunc // sessionID -> cancel
	teamRoundRobin map[string]int                // teamID -> last assigned index
	mu             sync.Mutex
	wailsCtx       context.Context
}

func NewTaskEngine(
	tasks *store.TaskStore,
	sessions *store.SessionStore,
	agents *store.AgentStore,
	projects *store.ProjectStore,
	mcpServers *store.MCPServerStore,
	teams *store.TeamStore,
	projectMgr *ProjectManager,
	runner *AgentRunner,
	diffTracker *DiffTracker,
	testRunner *TestRunner,
) *TaskEngine {
	return &TaskEngine{
		tasks:          tasks,
		sessions:       sessions,
		agents:         agents,
		projects:       projects,
		mcpServers:     mcpServers,
		teams:          teams,
		projectMgr:     projectMgr,
		runner:         runner,
		diffTracker:    diffTracker,
		testRunner:     testRunner,
		cancelFuncs:    make(map[string]context.CancelFunc),
		teamRoundRobin: make(map[string]int),
	}
}

// SetWailsContext sets the Wails runtime context for event emission.
func (te *TaskEngine) SetWailsContext(ctx context.Context) {
	te.wailsCtx = ctx
}

// StartSession begins executing all tasks in a session, respecting dependencies.
func (te *TaskEngine) StartSession(sessionID string) error {
	session, err := te.sessions.GetByID(sessionID)
	if err != nil {
		return fmt.Errorf("session not found: %w", err)
	}

	// Get project for test/build commands
	project, err := te.projects.GetByID(session.ProjectID)
	if err != nil {
		return fmt.Errorf("project not found: %w", err)
	}

	// Mark session as running
	if err := te.sessions.UpdateStatus(sessionID, models.SessionStatusRunning); err != nil {
		return fmt.Errorf("update session: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	te.mu.Lock()
	te.cancelFuncs[sessionID] = cancel
	te.mu.Unlock()

	te.emitSessionStatus(sessionID, "running")

	// Run execution loop in background
	go te.executeSession(ctx, sessionID, project)

	return nil
}

// StopSession cancels all running tasks in a session.
func (te *TaskEngine) StopSession(sessionID string) error {
	te.mu.Lock()
	cancel, ok := te.cancelFuncs[sessionID]
	te.mu.Unlock()

	if !ok {
		return fmt.Errorf("session %s is not running", sessionID)
	}

	cancel()

	// Cancel all running tasks
	tasks, _ := te.tasks.ListBySession(sessionID)
	for _, task := range tasks {
		if task.Status == models.TaskStatusRunning {
			te.runner.StopTask(task.ID)
			te.tasks.UpdateStatus(task.ID, models.TaskStatusCancelled)
		} else if task.Status == models.TaskStatusQueued {
			te.tasks.UpdateStatus(task.ID, models.TaskStatusCancelled)
		}
	}

	te.sessions.UpdateStatus(sessionID, models.SessionStatusFailed)
	te.emitSessionStatus(sessionID, "cancelled")
	return nil
}

// StopAllSessions cancels all running sessions gracefully.
func (te *TaskEngine) StopAllSessions() {
	te.mu.Lock()
	cancels := make([]context.CancelFunc, 0, len(te.cancelFuncs))
	for _, cancel := range te.cancelFuncs {
		cancels = append(cancels, cancel)
	}
	te.mu.Unlock()

	for _, cancel := range cancels {
		cancel()
	}

	te.runner.StopAll()
}

func (te *TaskEngine) executeSession(ctx context.Context, sessionID string, project *models.Project) {
	defer func() {
		te.mu.Lock()
		delete(te.cancelFuncs, sessionID)
		te.mu.Unlock()
	}()

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		tasks, err := te.tasks.ListBySession(sessionID)
		if err != nil {
			log.Printf("error listing tasks: %v", err)
			return
		}

		// Check if all done
		allDone := true
		anyFailed := false
		for _, t := range tasks {
			switch t.Status {
			case models.TaskStatusPending, models.TaskStatusQueued, models.TaskStatusRunning:
				allDone = false
			case models.TaskStatusFailed:
				anyFailed = true
			}
		}

		if allDone {
			status := models.SessionStatusCompleted
			if anyFailed {
				status = models.SessionStatusFailed
			}
			te.sessions.UpdateStatus(sessionID, status)
			te.emitSessionStatus(sessionID, string(status))
			return
		}

		// Find tasks ready to run (pending with all deps completed)
		readyTasks := te.findReadyTasks(tasks)

		// Launch ready tasks in parallel
		var wg sync.WaitGroup
		for _, task := range readyTasks {
			wg.Add(1)

			// Mark as queued
			te.tasks.UpdateStatus(task.ID, models.TaskStatusQueued)
			te.emitTaskStatus(task.ID, "queued")

			go func() {
				defer wg.Done()
				te.executeTask(ctx, &task, project)
			}()
		}

		// Wait briefly before checking again
		if len(readyTasks) == 0 {
			time.Sleep(500 * time.Millisecond)
		} else {
			wg.Wait()
		}
	}
}

func (te *TaskEngine) executeTask(ctx context.Context, task *models.Task, project *models.Project) {
	// Panic recovery - ensure task is marked as failed on unexpected errors
	defer func() {
		if r := recover(); r != nil {
			errMsg := fmt.Sprintf("panic during task execution: %v", r)
			log.Printf("PANIC in task %s: %v", task.ID, r)
			te.failTask(task, errMsg)
		}
	}()

	// Get agent — resolve from team if team_id is set
	if task.AgentID == "" && task.TeamID != "" {
		selectedID, teamErr := te.selectAgentFromTeam(task.TeamID)
		if teamErr != nil {
			te.failTask(task, fmt.Sprintf("team agent selection failed: %v", teamErr))
			return
		}
		task.AgentID = selectedID
		te.tasks.Update(task)
		log.Printf("task %s: assigned agent %s from team %s", task.ID, selectedID, task.TeamID)
	} else if task.AgentID == "" {
		// Auto-assign: pick the best matching agent based on task content
		agents, listErr := te.agents.List()
		if listErr != nil || len(agents) == 0 {
			te.failTask(task, "no agent assigned and no agents available: please create an agent first")
			return
		}
		best := matchAgentToTask(agents, task)
		task.AgentID = best.ID
		te.tasks.Update(task)
		log.Printf("task %s: auto-assigned agent %s (%s)", task.ID, best.Name, best.ID)
	}
	agent, err := te.agents.GetByID(task.AgentID)
	if err != nil {
		te.failTask(task, fmt.Sprintf("agent not found (id=%s): %v", task.AgentID, err))
		return
	}

	// Create workspace
	workDir, err := te.projectMgr.CreateWorkspace(project.Path, task.SessionID, task.ID)
	if err != nil {
		te.failTask(task, fmt.Sprintf("workspace creation failed: %v", err))
		return
	}

	// Update task with workspace path
	task.WorkspacePath = workDir
	te.tasks.Update(task)

	// Inject .mcp.json if agent has MCP servers configured
	if err := te.injectMCPConfig(agent, workDir); err != nil {
		log.Printf("task %s: warning: failed to inject .mcp.json: %v", task.ID, err)
	}

	// Run project setup command if configured
	if project.SetupCommand != "" {
		log.Printf("task %s: running setup command: %s", task.ID, project.SetupCommand)
		if te.wailsCtx != nil {
			wailsRuntime.EventsEmit(te.wailsCtx, "task:stream", map[string]any{
				"task_id": task.ID,
				"type":    "init",
				"content": fmt.Sprintf("Running setup command: %s", project.SetupCommand),
			})
		}
		setupCmd := exec.Command("sh", "-c", project.SetupCommand)
		setupCmd.Dir = workDir
		setupCmd.Env = append(os.Environ(),
			"WORKSPACE_PATH="+workDir,
			"PROJECT_PATH="+project.Path,
			"TASK_ID="+task.ID,
			"SESSION_ID="+task.SessionID,
		)
		if output, setupErr := setupCmd.CombinedOutput(); setupErr != nil {
			log.Printf("task %s: setup command failed: %v\nOutput: %s", task.ID, setupErr, string(output))
			if te.wailsCtx != nil {
				wailsRuntime.EventsEmit(te.wailsCtx, "task:stream", map[string]any{
					"task_id": task.ID,
					"type":    "error",
					"content": fmt.Sprintf("Setup command failed: %v\n%s", setupErr, string(output)),
				})
			}
			// Don't fail the task — setup command failure is a warning
		} else {
			log.Printf("task %s: setup command completed successfully", task.ID)
			if te.wailsCtx != nil && len(output) > 0 {
				wailsRuntime.EventsEmit(te.wailsCtx, "task:stream", map[string]any{
					"task_id": task.ID,
					"type":    "init",
					"content": strings.TrimSpace(string(output)),
				})
			}
		}
	}

	// Mark as running
	now := time.Now()
	task.StartedAt = &now
	task.Status = models.TaskStatusRunning
	te.tasks.Update(task)
	te.emitTaskStatus(task.ID, "running")

	// Start real-time diff watcher
	diffDone := make(chan struct{})
	go te.watchDiffs(ctx, task.ID, project.Path, workDir, diffDone)

	// Run Claude
	if task.Prompt == "" {
		close(diffDone)
		te.failTask(task, "task has no prompt: cannot execute without instructions")
		return
	}
	log.Printf("task %s: starting claude (agent=%s, model=%s, prompt_len=%d, workdir=%s)", task.ID, agent.Name, agent.Model, len(task.Prompt), workDir)
	runErr := te.runner.RunTask(ctx, task, agent, workDir, RunTaskOptions{
		OnSessionID: func(sessionID string) {
			log.Printf("task %s: captured claude session_id: %s", task.ID, sessionID)
			task.ClaudeSessionID = sessionID
			te.tasks.Update(task)
		},
	})

	// Stop diff watcher
	close(diffDone)

	if runErr != nil {
		log.Printf("task %s: claude process error: %v", task.ID, runErr)
	} else {
		log.Printf("task %s: claude process completed successfully", task.ID)
	}

	// Compute diff
	diffResult, _ := te.diffTracker.ComputeDiff(project.Path, workDir)
	if diffResult != nil {
		var changedFiles []string
		for _, f := range diffResult.Files {
			changedFiles = append(changedFiles, f.Path)
		}
		task.FilesChanged = models.StringSlice(changedFiles)

		// Emit diff to frontend
		if te.wailsCtx != nil {
			wailsRuntime.EventsEmit(te.wailsCtx, "task:diff", map[string]any{
				"task_id": task.ID,
				"diff":    diffResult,
			})
		}
	}

	// Run tests
	if testResult := te.testRunner.RunTest(workDir, project.TestCommand); testResult != nil {
		task.TestPassed = &testResult.Passed
		task.TestOutput = testResult.Output
		if te.wailsCtx != nil {
			wailsRuntime.EventsEmit(te.wailsCtx, "task:test", map[string]any{
				"task_id":     task.ID,
				"test_passed": testResult.Passed,
				"output":      testResult.Output,
			})
		}
	}

	// Run build
	if buildResult := te.testRunner.RunBuild(workDir, project.BuildCommand); buildResult != nil {
		task.BuildPassed = &buildResult.Passed
		task.BuildOutput = buildResult.Output
		if te.wailsCtx != nil {
			wailsRuntime.EventsEmit(te.wailsCtx, "task:build", map[string]any{
				"task_id":      task.ID,
				"build_passed": buildResult.Passed,
				"output":       buildResult.Output,
			})
		}
	}

	// Determine final status
	completedAt := time.Now()
	task.CompletedAt = &completedAt

	if runErr != nil {
		task.Status = models.TaskStatusFailed
		task.Error = runErr.Error()
	} else {
		task.Status = models.TaskStatusCompleted
		task.ExitCode = 0
	}

	te.tasks.Update(task)
	te.emitTaskStatus(task.ID, string(task.Status))
}

func (te *TaskEngine) findReadyTasks(tasks []models.Task) []models.Task {
	completedIDs := make(map[string]bool)
	for _, t := range tasks {
		if t.Status == models.TaskStatusCompleted {
			completedIDs[t.ID] = true
		}
	}

	var ready []models.Task
	for _, t := range tasks {
		if t.Status != models.TaskStatusPending {
			continue
		}

		// Check all dependencies are completed
		allDepsComplete := true
		for _, depID := range t.Dependencies {
			if !completedIDs[depID] {
				allDepsComplete = false
				break
			}
		}

		if allDepsComplete {
			ready = append(ready, t)
		}
	}
	return ready
}

// matchAgentToTask picks the best agent for a task by keyword-matching the task
// title and prompt against each agent's name and description. Falls back to
// the first agent if no keywords match.
func matchAgentToTask(agents []models.Agent, task *models.Task) models.Agent {
	if len(agents) == 1 {
		return agents[0]
	}

	taskText := strings.ToLower(task.Title + " " + task.Prompt)

	bestAgent := agents[0]
	bestScore := 0

	for _, a := range agents {
		score := 0
		// Split agent name and description into words and check for matches
		words := strings.Fields(strings.ToLower(a.Name + " " + a.Description))
		for _, w := range words {
			if len(w) < 3 {
				continue // skip short words like "a", "or", "the"
			}
			if strings.Contains(taskText, w) {
				score++
			}
		}
		if score > bestScore {
			bestScore = score
			bestAgent = a
		}
	}

	return bestAgent
}

// selectAgentFromTeam picks an agent from a team based on the team's strategy.
// Parallel: round-robin across team members.
// Sequential: follows edge order (root agent first).
// Planner: same as parallel.
func (te *TaskEngine) selectAgentFromTeam(teamID string) (string, error) {
	team, err := te.teams.GetByID(teamID)
	if err != nil {
		return "", fmt.Errorf("team not found: %w", err)
	}
	if len(team.AgentIDs) == 0 {
		return "", fmt.Errorf("team %q has no agents", team.Name)
	}

	switch team.Strategy {
	case models.TeamStrategySequential:
		// Follow edge order: find the root agent (agent with no incoming edges)
		if len(team.Edges) > 0 {
			targets := make(map[string]bool)
			for _, edge := range team.Edges {
				targets[edge.Target] = true
			}
			for _, agentID := range team.AgentIDs {
				if !targets[agentID] {
					return agentID, nil
				}
			}
		}
		// Fallback: first agent
		return team.AgentIDs[0], nil

	default: // parallel, planner
		// Round-robin distribution
		te.mu.Lock()
		idx := te.teamRoundRobin[teamID]
		te.teamRoundRobin[teamID] = (idx + 1) % len(team.AgentIDs)
		te.mu.Unlock()
		return team.AgentIDs[idx], nil
	}
}

func (te *TaskEngine) failTask(task *models.Task, errMsg string) {
	log.Printf("task %s FAILED: %s", task.ID, errMsg)
	task.Status = models.TaskStatusFailed
	task.Error = errMsg
	now := time.Now()
	task.CompletedAt = &now
	te.tasks.Update(task)

	// Emit error as a stream event so it shows in Live Output
	if te.wailsCtx != nil {
		wailsRuntime.EventsEmit(te.wailsCtx, "task:stream", map[string]any{
			"task_id": task.ID,
			"type":    "error",
			"content": errMsg,
		})
	}
	te.emitTaskStatus(task.ID, "failed")
}

func (te *TaskEngine) emitTaskStatus(taskID string, status string) {
	if te.wailsCtx != nil {
		wailsRuntime.EventsEmit(te.wailsCtx, "task:status", map[string]any{
			"task_id": taskID,
			"status":  status,
		})
	}
}

func (te *TaskEngine) emitSessionStatus(sessionID string, status string) {
	if te.wailsCtx != nil {
		wailsRuntime.EventsEmit(te.wailsCtx, "session:status", map[string]any{
			"session_id": sessionID,
			"status":     status,
		})
	}
}

// watchDiffs periodically computes diffs and emits them to the frontend while a task is running.
func (te *TaskEngine) watchDiffs(ctx context.Context, taskID, originalPath, workspacePath string, done <-chan struct{}) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	var lastHash string

	for {
		select {
		case <-ctx.Done():
			return
		case <-done:
			return
		case <-ticker.C:
			diffResult, err := te.diffTracker.ComputeDiff(originalPath, workspacePath)
			if err != nil || diffResult == nil {
				continue
			}

			currentHash := te.diffHash(diffResult)
			if currentHash == lastHash {
				continue
			}
			lastHash = currentHash

			if te.wailsCtx != nil {
				wailsRuntime.EventsEmit(te.wailsCtx, "task:diff", map[string]any{
					"task_id": taskID,
					"diff":    diffResult,
				})
			}
		}
	}
}

// diffHash creates a simple hash string from a DiffResult for change detection.
func (te *TaskEngine) diffHash(result *DiffResult) string {
	var parts []string
	for _, f := range result.Files {
		parts = append(parts, fmt.Sprintf("%s:%s:%d", f.Path, f.Status, len(f.Diff)))
	}
	return strings.Join(parts, "|")
}

// injectMCPConfig writes a .mcp.json file into the workspace directory
// based on the agent's configured MCP server IDs. Claude Code reads this
// file at startup to discover available MCP servers.
func (te *TaskEngine) injectMCPConfig(agent *models.Agent, workDir string) error {
	if len(agent.MCPServerIDs) == 0 {
		return nil
	}

	servers, err := te.mcpServers.ListByIDs(agent.MCPServerIDs)
	if err != nil {
		return fmt.Errorf("fetch MCP servers: %w", err)
	}

	if len(servers) == 0 {
		return nil
	}

	// Build .mcp.json structure
	type mcpServerEntry struct {
		Command string            `json:"command"`
		Args    []string          `json:"args,omitempty"`
		Env     map[string]string `json:"env,omitempty"`
	}

	mcpConfig := struct {
		MCPServers map[string]mcpServerEntry `json:"mcpServers"`
	}{
		MCPServers: make(map[string]mcpServerEntry),
	}

	for _, srv := range servers {
		if !srv.Enabled {
			continue
		}
		entry := mcpServerEntry{
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

	if len(mcpConfig.MCPServers) == 0 {
		return nil
	}

	data, err := json.MarshalIndent(mcpConfig, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal .mcp.json: %w", err)
	}

	mcpPath := filepath.Join(workDir, ".mcp.json")
	if err := os.WriteFile(mcpPath, data, 0644); err != nil {
		return fmt.Errorf("write .mcp.json: %w", err)
	}

	log.Printf("task: injected .mcp.json with %d server(s) into %s", len(mcpConfig.MCPServers), workDir)
	return nil
}

// SendFollowUp sends a follow-up prompt to a completed/failed task using --resume.
func (te *TaskEngine) SendFollowUp(taskID string, message string, mode string) error {
	task, err := te.tasks.GetByID(taskID)
	if err != nil {
		return fmt.Errorf("task not found: %w", err)
	}

	if task.ClaudeSessionID == "" {
		return fmt.Errorf("task has no claude session to resume")
	}

	// If task is currently running, stop it first
	if task.Status == models.TaskStatusRunning {
		te.runner.StopTask(taskID)
		time.Sleep(500 * time.Millisecond) // brief wait for process cleanup
	}

	agent, err := te.agents.GetByID(task.AgentID)
	if err != nil {
		return fmt.Errorf("agent not found: %w", err)
	}

	// Apply mode overrides
	agentCopy := *agent
	switch mode {
	case "plan":
		agentCopy.SystemPrompt = "Describe your planned changes step by step before making any edits. Wait for the user to approve before proceeding.\n\n" + agentCopy.SystemPrompt
	case "auto":
		agentCopy.Permissions = "bypassPermissions"
	}

	// Determine working directory
	workDir := task.WorkspacePath
	if workDir == "" {
		session, err := te.sessions.GetByID(task.SessionID)
		if err != nil {
			return fmt.Errorf("session not found: %w", err)
		}
		project, err := te.projects.GetByID(session.ProjectID)
		if err != nil {
			return fmt.Errorf("project not found: %w", err)
		}
		workDir = project.Path
	}

	// Mark task as running
	now := time.Now()
	task.Status = models.TaskStatusRunning
	task.StartedAt = &now
	task.Error = ""
	te.tasks.Update(task)
	te.emitTaskStatus(task.ID, "running")

	// Run follow-up in background
	go func() {
		runErr := te.runner.RunTask(context.Background(), task, &agentCopy, workDir, RunTaskOptions{
			SessionID: task.ClaudeSessionID,
			Prompt:    message,
			OnSessionID: func(sessionID string) {
				// Update session ID if it changed
				if sessionID != task.ClaudeSessionID {
					task.ClaudeSessionID = sessionID
					te.tasks.Update(task)
				}
			},
		})

		completedAt := time.Now()
		task.CompletedAt = &completedAt

		if runErr != nil {
			task.Status = models.TaskStatusFailed
			task.Error = runErr.Error()
		} else {
			task.Status = models.TaskStatusCompleted
		}

		te.tasks.Update(task)
		te.emitTaskStatus(task.ID, string(task.Status))
	}()

	return nil
}
