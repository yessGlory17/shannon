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
	sessionCtxs    map[string]context.Context    // sessionID -> context (for follow-ups)
	teamRoundRobin map[string]int                // teamID -> last assigned index
	taskInFlight   map[string]*sync.Mutex        // per-task mutex for follow-up serialization
	mu             sync.Mutex
	wailsCtx       context.Context

	// taskDone is signalled whenever a task finishes execution (completed/failed).
	// The session loop selects on this instead of polling with time.Sleep.
	taskDone chan string // carries sessionID of the finished task's session
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
		sessionCtxs:    make(map[string]context.Context),
		teamRoundRobin: make(map[string]int),
		taskInFlight:   make(map[string]*sync.Mutex),
		taskDone:       make(chan string, 64),
	}
}

// SetWailsContext sets the Wails runtime context for event emission.
func (te *TaskEngine) SetWailsContext(ctx context.Context) {
	te.wailsCtx = ctx
}

// taskMutex returns a per-task mutex, creating one if it doesn't exist.
// Used to serialize follow-up operations on the same task.
func (te *TaskEngine) taskMutex(taskID string) *sync.Mutex {
	te.mu.Lock()
	defer te.mu.Unlock()
	m, ok := te.taskInFlight[taskID]
	if !ok {
		m = &sync.Mutex{}
		te.taskInFlight[taskID] = m
	}
	return m
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
	te.sessionCtxs[sessionID] = ctx
	te.mu.Unlock()

	te.emitSessionStatus(sessionID, "running")

	// Run execution loop in background
	go te.executeSession(ctx, sessionID, project)

	return nil
}

// StopSession cancels all running tasks in a session.
// If all tasks are already completed/failed, the session is marked as completed.
func (te *TaskEngine) StopSession(sessionID string) error {
	te.mu.Lock()
	cancel, ok := te.cancelFuncs[sessionID]
	te.mu.Unlock()

	if !ok {
		return fmt.Errorf("session %s is not running", sessionID)
	}

	cancel()

	// Check task states and cancel any that are still active
	tasks, _ := te.tasks.ListBySession(sessionID)
	hasActive := false
	hasFailed := false
	for _, task := range tasks {
		switch task.Status {
		case models.TaskStatusRunning:
			te.runner.StopTask(task.ID)
			te.tasks.UpdateStatus(task.ID, models.TaskStatusCancelled)
			hasActive = true
		case models.TaskStatusQueued, models.TaskStatusAwaitingInput:
			te.tasks.UpdateStatus(task.ID, models.TaskStatusCancelled)
			hasActive = true
		case models.TaskStatusPending:
			te.tasks.UpdateStatus(task.ID, models.TaskStatusCancelled)
			hasActive = true
		case models.TaskStatusFailed:
			hasFailed = true
		}
	}

	// If no tasks were actively running, this is a graceful completion
	if !hasActive {
		status := models.SessionStatusCompleted
		if hasFailed {
			status = models.SessionStatusFailed
		}
		te.sessions.UpdateStatus(sessionID, status)
		te.emitSessionStatus(sessionID, string(status))
	} else {
		te.sessions.UpdateStatus(sessionID, models.SessionStatusFailed)
		te.emitSessionStatus(sessionID, "cancelled")
	}

	// Clean up event buffers for all tasks in this session
	for _, task := range tasks {
		te.runner.CleanupTaskEvents(task.ID)
	}

	return nil
}

// CompleteSession gracefully ends a session, marking it as completed.
// Use this when all tasks are done and the user wants to finalize the session.
func (te *TaskEngine) CompleteSession(sessionID string) error {
	te.mu.Lock()
	cancel, ok := te.cancelFuncs[sessionID]
	te.mu.Unlock()

	if ok {
		cancel()
	}

	tasks, _ := te.tasks.ListBySession(sessionID)
	hasFailed := false
	for _, task := range tasks {
		if task.Status == models.TaskStatusFailed {
			hasFailed = true
			break
		}
	}

	status := models.SessionStatusCompleted
	if hasFailed {
		status = models.SessionStatusFailed
	}
	te.sessions.UpdateStatus(sessionID, status)
	te.emitSessionStatus(sessionID, string(status))

	// Clean up event buffers for all tasks in this session
	for _, task := range tasks {
		te.runner.CleanupTaskEvents(task.ID)
	}

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

// notifyTaskDone signals the session loop that a task has finished, unblocking
// the event-driven wait without polling.
func (te *TaskEngine) notifyTaskDone(sessionID string) {
	select {
	case te.taskDone <- sessionID:
	default:
		// Channel full — session loop will pick it up on next iteration anyway
	}
}

func (te *TaskEngine) executeSession(ctx context.Context, sessionID string, project *models.Project) {
	defer func() {
		te.mu.Lock()
		delete(te.cancelFuncs, sessionID)
		delete(te.sessionCtxs, sessionID)
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

		// Check if all done (no pending/queued/running tasks)
		allDone := true
		for _, t := range tasks {
			switch t.Status {
			case models.TaskStatusPending, models.TaskStatusQueued, models.TaskStatusRunning:
				allDone = false
			}
		}

		if allDone {
			// All tasks finished — keep session alive for follow-up interactions.
			// Wait for a task-done signal (e.g. from follow-up) or context cancellation.
			select {
			case <-ctx.Done():
				return
			case sid := <-te.taskDone:
				if sid == sessionID {
					continue
				}
				// Re-queue signal for the other session
				te.notifyTaskDone(sid)
				// Still wait for our own signal
				select {
				case <-ctx.Done():
					return
				case <-te.taskDone:
					continue
				case <-time.After(2 * time.Second):
					continue
				}
			case <-time.After(2 * time.Second):
				// Fallback timeout to avoid indefinite blocking
				continue
			}
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

			taskCopy := task
			go func() {
				defer wg.Done()
				te.executeTask(ctx, &taskCopy, project)
				// Signal session loop that a task finished
				te.notifyTaskDone(sessionID)
			}()
		}

		if len(readyTasks) == 0 {
			// No ready tasks but some are still pending (waiting for deps).
			// Wait for a task-done signal instead of polling.
			select {
			case <-ctx.Done():
				return
			case <-te.taskDone:
				continue
			case <-time.After(2 * time.Second):
				// Fallback to prevent indefinite blocking
			}
		} else {
			// Wait for all launched tasks, but respect context cancellation
			done := make(chan struct{})
			go func() {
				wg.Wait()
				close(done)
			}()
			select {
			case <-ctx.Done():
				return
			case <-done:
			}
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

	// Preserve original prompt for retry (only on first execution)
	if task.OriginalPrompt == "" {
		task.OriginalPrompt = task.Prompt
		te.tasks.Update(task)
	}

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

	// Agents work directly on the project directory — no workspace copy.
	workDir := project.Path
	task.WorkspacePath = workDir
	te.tasks.Update(task)

	// Inject CLAUDE.md if project has persistent context
	if project.ClaudeMD != "" {
		if err := te.injectClaudeMD(workDir, project.ClaudeMD); err != nil {
			log.Printf("task %s: warning: failed to inject CLAUDE.md: %v", task.ID, err)
		}
	}

	// Inject .mcp.json if agent has MCP servers configured.
	// injectMCPConfig does NOT modify agent; MCP tool patterns are merged below.
	mcpConfigPath, mcpServerKeys, mcpErr := te.injectMCPConfig(agent, workDir)
	if mcpErr != nil {
		log.Printf("task %s: warning: failed to inject .mcp.json: %v", task.ID, mcpErr)
	}

	// Persist MCP config path for follow-ups
	if mcpConfigPath != "" {
		task.MCPConfigPath = mcpConfigPath
		te.tasks.Update(task)
	}

	// Run project setup commands if configured
	for i, cmd := range project.SetupCommands {
		cmd = strings.TrimSpace(cmd)
		if cmd == "" {
			continue
		}
		log.Printf("task %s: running setup command [%d/%d]: %s", task.ID, i+1, len(project.SetupCommands), cmd)
		if te.wailsCtx != nil {
			wailsRuntime.EventsEmit(te.wailsCtx, "task:stream", map[string]any{
				"task_id": task.ID,
				"type":    "init",
				"content": fmt.Sprintf("Running setup command [%d/%d]: %s", i+1, len(project.SetupCommands), cmd),
			})
		}
		setupCmd := exec.Command("sh", "-c", cmd)
		setupCmd.Dir = workDir
		setupCmd.Env = append(os.Environ(),
			"WORKSPACE_PATH="+workDir,
			"PROJECT_PATH="+project.Path,
			"TASK_ID="+task.ID,
			"SESSION_ID="+task.SessionID,
		)
		if output, setupErr := setupCmd.CombinedOutput(); setupErr != nil {
			log.Printf("task %s: setup command [%d] failed: %v\nOutput: %s", task.ID, i+1, setupErr, string(output))
			if te.wailsCtx != nil {
				wailsRuntime.EventsEmit(te.wailsCtx, "task:stream", map[string]any{
					"task_id": task.ID,
					"type":    "error",
					"content": fmt.Sprintf("Setup command [%d] failed: %v\n%s", i+1, setupErr, string(output)),
				})
			}
			// Don't fail the task — setup command failure is a warning
		} else {
			log.Printf("task %s: setup command [%d] completed successfully", task.ID, i+1)
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

	// Start real-time diff watcher (git-based, single directory)
	diffDone := make(chan struct{})
	go te.watchDiffs(ctx, task.ID, project.Path, diffDone)

	// Build a local copy of agent to avoid mutating the original (which is shared/reusable).
	// Merge effective permissions and MCP tool patterns into the copy.
	agentForRun := *agent
	agentForRun.DisallowedTools = models.StringSlice(te.buildEffectivePermissions(agent))

	// Merge MCP tool patterns into AllowedTools (only if agent has a whitelist)
	if mcpConfigPath != "" {
		if extra := mcpToolPatterns(agent.AllowedTools, mcpServerKeys); len(extra) > 0 {
			merged := make([]string, len(agent.AllowedTools), len(agent.AllowedTools)+len(extra))
			copy(merged, agent.AllowedTools)
			agentForRun.AllowedTools = append(merged, extra...)
		}
	}

	// Run Claude
	if task.Prompt == "" {
		close(diffDone)
		te.failTask(task, "task has no prompt: cannot execute without instructions")
		return
	}
	log.Printf("task %s: starting claude (agent=%s, model=%s, prompt_len=%d, workdir=%s)", task.ID, agent.Name, agent.Model, len(task.Prompt), workDir)
	runResult, runErr := te.runner.RunTask(ctx, task, &agentForRun, workDir, RunTaskOptions{
		MCPConfigPath: mcpConfigPath,
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
	} else if runResult != nil {
		log.Printf("task %s: claude process completed (events=%d, exit_code=%d, has_output=%v)", task.ID, runResult.EventCount, runResult.ExitCode, runResult.LastText != "")
	} else {
		log.Printf("task %s: claude process completed (nil result)", task.ID)
	}

	// Compute diff using git
	diffResult, _ := te.diffTracker.ComputeDiff(project.Path)
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

	// Re-read task from DB before final update to avoid overwriting concurrent changes
	// (e.g. a follow-up may have updated ClaudeSessionID while we were running).
	if freshTask, readErr := te.tasks.GetByID(task.ID); readErr == nil {
		// Preserve fields set during this execution
		freshTask.FilesChanged = task.FilesChanged
		freshTask.TestPassed = task.TestPassed
		freshTask.TestOutput = task.TestOutput
		freshTask.BuildPassed = task.BuildPassed
		freshTask.BuildOutput = task.BuildOutput
		freshTask.WorkspacePath = task.WorkspacePath
		freshTask.MCPConfigPath = task.MCPConfigPath
		freshTask.ClaudeSessionID = task.ClaudeSessionID
		freshTask.OriginalPrompt = task.OriginalPrompt
		task = freshTask
	}

	// Determine final status
	completedAt := time.Now()
	task.CompletedAt = &completedAt

	if runErr != nil {
		// Check if we should auto-retry
		if task.RetryCount < task.MaxRetries {
			task.RetryCount++
			task.Status = models.TaskStatusPending
			task.Error = fmt.Sprintf("Retry %d/%d: %s", task.RetryCount, task.MaxRetries, runErr.Error())
			task.ClaudeSessionID = "" // fresh session for retry
			task.CompletedAt = nil
			// Restore original prompt and append error context
			if task.OriginalPrompt != "" {
				task.Prompt = te.buildRetryPrompt(task.OriginalPrompt, runErr.Error(), task.RetryCount)
			} else {
				task.Prompt = te.buildRetryPrompt(task.Prompt, runErr.Error(), task.RetryCount)
			}
			te.tasks.Update(task)
			te.emitTaskStatus(task.ID, "pending")
			log.Printf("task %s: auto-retrying (%d/%d) after error: %v", task.ID, task.RetryCount, task.MaxRetries, runErr)

			// Exponential backoff before re-queuing (ctx-aware)
			backoff := time.Duration(1<<uint(task.RetryCount-1)) * time.Second
			select {
			case <-ctx.Done():
				return
			case <-time.After(backoff):
			}
			return
		}

		task.Status = models.TaskStatusFailed
		task.Error = runErr.Error()
	} else if runResult != nil && runResult.NeedsInput {
		// Agent is asking for user input — mark as awaiting_input
		task.Status = models.TaskStatusAwaitingInput
		task.PendingInputData = runResult.LastText
		task.CompletedAt = nil // not truly completed yet
		log.Printf("task %s: agent needs user input, marking as awaiting_input", task.ID)
	} else {
		// Set exit code and result text from RunResult
		if runResult != nil {
			task.ExitCode = runResult.ExitCode
			if task.ResultText == "" && runResult.LastText != "" {
				task.ResultText = runResult.LastText
			}
		}
		// Determine status based on test/build results
		if task.TestPassed != nil && !*task.TestPassed {
			task.Status = models.TaskStatusFailed
			task.Error = "Tests failed"
		} else if task.BuildPassed != nil && !*task.BuildPassed {
			task.Status = models.TaskStatusFailed
			task.Error = "Build failed"
		} else {
			task.Status = models.TaskStatusCompleted
		}
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

// buildRetryPrompt enhances the original prompt with error context for retry attempts.
func (te *TaskEngine) buildRetryPrompt(originalPrompt, errorMsg string, attempt int) string {
	return fmt.Sprintf("%s\n\n[RETRY ATTEMPT %d]\nThe previous attempt failed with error:\n%s\nPlease try a different approach to avoid this error.", originalPrompt, attempt, errorMsg)
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

// watchDiffs periodically computes diffs using git and emits them to the frontend while a task is running.
func (te *TaskEngine) watchDiffs(ctx context.Context, taskID, projectPath string, done <-chan struct{}) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	var lastHash string

	for {
		select {
		case <-ctx.Done():
			return
		case <-done:
			return
		case <-ticker.C:
			diffResult, err := te.diffTracker.ComputeDiff(projectPath)
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
	var sb strings.Builder
	sb.Grow(len(result.Files) * 50)
	for i, f := range result.Files {
		if i > 0 {
			sb.WriteByte('|')
		}
		fmt.Fprintf(&sb, "%s:%s:%d", f.Path, f.Status, len(f.Diff))
	}
	return sb.String()
}

// injectClaudeMD writes a .claude/CLAUDE.md file into the workspace directory.
// Claude Code automatically reads this file for project-level context.
func (te *TaskEngine) injectClaudeMD(workDir string, content string) error {
	claudeDir := filepath.Join(workDir, ".claude")
	if err := os.MkdirAll(claudeDir, 0755); err != nil {
		return fmt.Errorf("create .claude dir: %w", err)
	}
	mdPath := filepath.Join(claudeDir, "CLAUDE.md")
	if err := os.WriteFile(mdPath, []byte(content), 0644); err != nil {
		return fmt.Errorf("write CLAUDE.md: %w", err)
	}
	log.Printf("task: injected CLAUDE.md (%d bytes) into %s", len(content), workDir)
	return nil
}

// buildEffectivePermissions converts agent's protected/read-only paths into
// Claude CLI --disallowedTools patterns.
func (te *TaskEngine) buildEffectivePermissions(agent *models.Agent) []string {
	var disallowed []string
	for _, path := range agent.ProtectedPaths {
		disallowed = append(disallowed, fmt.Sprintf("Write(%s)", path))
		disallowed = append(disallowed, fmt.Sprintf("Edit(%s)", path))
	}
	for _, path := range agent.ReadOnlyPaths {
		disallowed = append(disallowed, fmt.Sprintf("Write(%s)", path))
		disallowed = append(disallowed, fmt.Sprintf("Edit(%s)", path))
	}
	disallowed = append(disallowed, agent.DisallowedTools...)
	return disallowed
}

// mcpToolPatterns computes the MCP tool permission patterns (mcp__<serverKey>__*)
// for the given server keys. These are needed in --allowedTools to unblock MCP usage.
// Returns nil if the agent has no AllowedTools constraint (all tools are allowed by default).
func mcpToolPatterns(agentAllowedTools []string, serverKeys []string) []string {
	if len(agentAllowedTools) == 0 {
		return nil // no whitelist → all tools allowed, no patterns needed
	}
	existing := make(map[string]bool, len(agentAllowedTools))
	for _, t := range agentAllowedTools {
		existing[t] = true
	}
	var patterns []string
	for _, key := range serverKeys {
		pattern := fmt.Sprintf("mcp__%s__*", key)
		if !existing[pattern] {
			patterns = append(patterns, pattern)
		}
	}
	return patterns
}

// injectMCPConfig writes a .mcp.json file into the workspace directory
// based on the agent's configured MCP server IDs. Claude Code reads this
// file at startup to discover available MCP servers.
//
// IMPORTANT: This function does NOT modify the agent object. MCP tool patterns
// are returned separately via mcpToolPatterns and must be merged by the caller.
//
// Returns the path to the written .mcp.json file, and the server keys that were included.
func (te *TaskEngine) injectMCPConfig(agent *models.Agent, workDir string) (string, []string, error) {
	if len(agent.MCPServerIDs) == 0 {
		return "", nil, nil
	}

	servers, err := te.mcpServers.ListByIDs(agent.MCPServerIDs)
	if err != nil {
		return "", nil, fmt.Errorf("fetch MCP servers: %w", err)
	}

	if len(servers) == 0 {
		log.Printf("task: agent has %d MCP server IDs but none found in DB: %v", len(agent.MCPServerIDs), agent.MCPServerIDs)
		return "", nil, nil
	}

	// Build .mcp.json structure — always include args/env fields (no omitempty)
	// to match the format Claude CLI expects.
	type mcpServerEntry struct {
		Command string            `json:"command"`
		Args    []string          `json:"args"`
		Env     map[string]string `json:"env"`
	}

	mcpConfig := struct {
		MCPServers map[string]mcpServerEntry `json:"mcpServers"`
	}{
		MCPServers: make(map[string]mcpServerEntry),
	}

	var serverKeys []string
	for _, srv := range servers {
		if !srv.Enabled {
			log.Printf("task: skipping disabled MCP server %q (key=%s)", srv.Name, srv.ServerKey)
			continue
		}
		if strings.TrimSpace(srv.Command) == "" {
			log.Printf("task: skipping MCP server %q (key=%s): empty command", srv.Name, srv.ServerKey)
			continue
		}
		args := srv.Args
		if args == nil {
			args = []string{}
		}
		env := srv.Env
		if env == nil {
			env = map[string]string{}
		}
		mcpConfig.MCPServers[srv.ServerKey] = mcpServerEntry{
			Command: srv.Command,
			Args:    args,
			Env:     env,
		}
		serverKeys = append(serverKeys, srv.ServerKey)
		log.Printf("task: adding MCP server %q (key=%s, cmd=%s, args=%v)", srv.Name, srv.ServerKey, srv.Command, srv.Args)
	}

	if len(mcpConfig.MCPServers) == 0 {
		return "", nil, nil
	}

	data, err := json.MarshalIndent(mcpConfig, "", "  ")
	if err != nil {
		return "", nil, fmt.Errorf("marshal .mcp.json: %w", err)
	}

	mcpPath := filepath.Join(workDir, ".mcp.json")
	if err := os.WriteFile(mcpPath, data, 0600); err != nil {
		return "", nil, fmt.Errorf("write .mcp.json: %w", err)
	}

	log.Printf("task: injected .mcp.json with %d server(s) into %s (path=%s)", len(mcpConfig.MCPServers), workDir, mcpPath)
	return mcpPath, serverKeys, nil
}

// SendFollowUp sends a follow-up prompt to a completed/failed task using --resume.
// Uses a per-task mutex to serialize concurrent follow-ups on the same task.
func (te *TaskEngine) SendFollowUp(taskID string, message string, mode string) error {
	// Acquire per-task mutex to prevent concurrent follow-ups on the same task.
	// The mutex is released in the background goroutine after the final DB update.
	taskMu := te.taskMutex(taskID)
	taskMu.Lock()

	task, err := te.tasks.GetByID(taskID)
	if err != nil {
		taskMu.Unlock()
		return fmt.Errorf("task not found: %w", err)
	}

	if task.ClaudeSessionID == "" {
		taskMu.Unlock()
		return fmt.Errorf("task has no claude session to resume")
	}

	// If task is currently running, stop it first
	if task.Status == models.TaskStatusRunning {
		te.runner.StopTask(taskID)
		time.Sleep(500 * time.Millisecond) // brief wait for process cleanup
	}

	agent, err := te.agents.GetByID(task.AgentID)
	if err != nil {
		taskMu.Unlock()
		return fmt.Errorf("agent not found: %w", err)
	}

	// Apply mode overrides on a copy — never modify the original agent
	agentCopy := *agent
	switch mode {
	case "plan":
		agentCopy.SystemPrompt = "Describe your planned changes step by step before making any edits. Wait for the user to approve before proceeding.\n\n" + agentCopy.SystemPrompt
	case "auto":
		agentCopy.Permissions = "bypassPermissions"
	}

	// Build effective disallowed tools for follow-up
	agentCopy.DisallowedTools = models.StringSlice(te.buildEffectivePermissions(&agentCopy))

	// Merge MCP tool patterns into AllowedTools for follow-up (same logic as executeTask).
	// Resolve server keys from DB since we only have MCPServerIDs (DB IDs) on the agent.
	if task.MCPConfigPath != "" && len(agent.MCPServerIDs) > 0 {
		if srvs, srvErr := te.mcpServers.ListByIDs(agent.MCPServerIDs); srvErr == nil {
			var keys []string
			for _, s := range srvs {
				if s.Enabled {
					keys = append(keys, s.ServerKey)
				}
			}
			if extra := mcpToolPatterns(agent.AllowedTools, keys); len(extra) > 0 {
				merged := make([]string, len(agent.AllowedTools), len(agent.AllowedTools)+len(extra))
				copy(merged, agent.AllowedTools)
				agentCopy.AllowedTools = append(merged, extra...)
			}
		}
	}

	// Determine working directory
	workDir := task.WorkspacePath
	if workDir == "" {
		session, sErr := te.sessions.GetByID(task.SessionID)
		if sErr != nil {
			taskMu.Unlock()
			return fmt.Errorf("session not found: %w", sErr)
		}
		project, pErr := te.projects.GetByID(session.ProjectID)
		if pErr != nil {
			taskMu.Unlock()
			return fmt.Errorf("project not found: %w", pErr)
		}
		workDir = project.Path
	}

	// Capture session ID before marking as running (used in goroutine)
	claudeSessionID := task.ClaudeSessionID

	// Mark task as running (preserve original StartedAt)
	task.Status = models.TaskStatusRunning
	if task.StartedAt == nil {
		now := time.Now()
		task.StartedAt = &now
	}
	task.Error = ""
	task.PendingInputData = ""
	if err := te.tasks.Update(task); err != nil {
		taskMu.Unlock()
		return fmt.Errorf("failed to update task status: %w", err)
	}
	te.emitTaskStatus(task.ID, "running")
	log.Printf("task %s: follow-up started (session=%s, prompt_len=%d)", task.ID, claudeSessionID, len(message))

	// Use session-scoped context so follow-up is cancelled when session stops.
	// Copy context reference under lock to avoid race with session cleanup.
	te.mu.Lock()
	sessionCtx, hasSessionCtx := te.sessionCtxs[task.SessionID]
	te.mu.Unlock()
	if !hasSessionCtx {
		sessionCtx = context.Background()
	}
	// Wrap in a derived context so we can detect cancellation safely
	followUpCtx, followUpCancel := context.WithCancel(sessionCtx)

	// Run follow-up in background
	go func() {
		defer taskMu.Unlock()
		defer followUpCancel()

		runResult, runErr := te.runner.RunTask(followUpCtx, task, &agentCopy, workDir, RunTaskOptions{
			SessionID:     claudeSessionID,
			Prompt:        message,
			MCPConfigPath: task.MCPConfigPath,
			OnSessionID: func(sessionID string) {
				// Update session ID if it changed
				if sessionID != claudeSessionID {
					log.Printf("task %s: follow-up session ID changed: %s -> %s", taskID, claudeSessionID, sessionID)
					claudeSessionID = sessionID
					// Persist new session ID immediately
					te.tasks.UpdateField(taskID, "claude_session_id", sessionID)
				}
			},
		})

		// Re-read task from DB to avoid overwriting concurrent changes
		freshTask, readErr := te.tasks.GetByID(taskID)
		if readErr != nil {
			log.Printf("task %s: failed to re-read task after follow-up: %v", taskID, readErr)
			return
		}

		completedAt := time.Now()
		freshTask.CompletedAt = &completedAt
		freshTask.ClaudeSessionID = claudeSessionID

		if runErr != nil {
			log.Printf("task %s: follow-up failed: %v", taskID, runErr)
			freshTask.Status = models.TaskStatusFailed
			freshTask.Error = runErr.Error()
			// Emit error as stream event so it shows in the UI
			if te.wailsCtx != nil {
				wailsRuntime.EventsEmit(te.wailsCtx, "task:stream", map[string]any{
					"task_id": taskID,
					"type":    "error",
					"content": fmt.Sprintf("Follow-up failed: %v", runErr),
				})
			}
		} else if runResult != nil && runResult.NeedsInput {
			freshTask.Status = models.TaskStatusAwaitingInput
			freshTask.PendingInputData = runResult.LastText
			freshTask.CompletedAt = nil
			log.Printf("task %s: follow-up needs user input, marking as awaiting_input", taskID)
		} else {
			log.Printf("task %s: follow-up completed successfully", taskID)
			freshTask.Status = models.TaskStatusCompleted
			if runResult != nil && runResult.LastText != "" {
				freshTask.ResultText = runResult.LastText
			}
		}

		if err := te.tasks.Update(freshTask); err != nil {
			log.Printf("task %s: failed to update task after follow-up: %v", taskID, err)
		}
		te.emitTaskStatus(taskID, string(freshTask.Status))
	}()

	return nil
}
