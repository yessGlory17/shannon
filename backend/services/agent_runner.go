package services

import (
	"agent-workflow/backend/claude"
	"agent-workflow/backend/models"
	"context"
	"fmt"
	"log"
	"strings"
	"sync"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// AgentRunner manages concurrent Claude Code CLI processes.
type AgentRunner struct {
	processes map[string]*claude.Process // taskID -> process
	mu        sync.RWMutex
	wailsCtx  context.Context
	cliPath   string

	// Event buffer: keeps all emitted events per task for later retrieval
	eventBuf   map[string][]claude.TaskStreamEvent
	eventBufMu sync.RWMutex
}

func NewAgentRunner(cliPath string) *AgentRunner {
	if cliPath == "" {
		cliPath = "claude"
	}
	return &AgentRunner{
		processes: make(map[string]*claude.Process),
		cliPath:   cliPath,
		eventBuf:  make(map[string][]claude.TaskStreamEvent),
	}
}

// SetWailsContext sets the Wails runtime context for event emission.
func (ar *AgentRunner) SetWailsContext(ctx context.Context) {
	ar.wailsCtx = ctx
}

// GetTaskEvents returns all buffered stream events for a task.
func (ar *AgentRunner) GetTaskEvents(taskID string) []claude.TaskStreamEvent {
	ar.eventBufMu.RLock()
	defer ar.eventBufMu.RUnlock()
	events := ar.eventBuf[taskID]
	if events == nil {
		return []claude.TaskStreamEvent{}
	}
	// Return a copy
	result := make([]claude.TaskStreamEvent, len(events))
	copy(result, events)
	return result
}

// GetSessionEvents returns all buffered stream events for multiple tasks.
func (ar *AgentRunner) GetSessionEvents(taskIDs []string) map[string][]claude.TaskStreamEvent {
	ar.eventBufMu.RLock()
	defer ar.eventBufMu.RUnlock()
	result := make(map[string][]claude.TaskStreamEvent, len(taskIDs))
	for _, id := range taskIDs {
		if events, ok := ar.eventBuf[id]; ok {
			cp := make([]claude.TaskStreamEvent, len(events))
			copy(cp, events)
			result[id] = cp
		}
	}
	return result
}

// CleanupTaskEvents removes buffered events for a task.
func (ar *AgentRunner) CleanupTaskEvents(taskID string) {
	ar.eventBufMu.Lock()
	defer ar.eventBufMu.Unlock()
	delete(ar.eventBuf, taskID)
}

// bufferEvent stores an event in the in-memory buffer.
func (ar *AgentRunner) bufferEvent(taskID string, event claude.TaskStreamEvent) {
	ar.eventBufMu.Lock()
	defer ar.eventBufMu.Unlock()
	ar.eventBuf[taskID] = append(ar.eventBuf[taskID], event)
}

// RunTaskOptions configures a RunTask invocation.
type RunTaskOptions struct {
	SessionID   string                 // Claude session ID for --resume (empty = new session)
	Prompt      string                 // Override task prompt (used for follow-ups)
	OnSessionID func(sessionID string) // Callback when Claude session_id is received
}

// RunResult carries information about how the task run completed.
type RunResult struct {
	NeedsInput bool   // true if the agent's output indicates it needs user input
	LastText   string // the last text output from the agent (for displaying in the UI)
}

// RunTask starts a Claude Code process for a task with the given agent configuration.
// It streams events to the frontend and returns when the process completes.
func (ar *AgentRunner) RunTask(ctx context.Context, task *models.Task, agent *models.Agent, workDir string, opts ...RunTaskOptions) (*RunResult, error) {
	var runOpts RunTaskOptions
	if len(opts) > 0 {
		runOpts = opts[0]
	}

	prompt := task.Prompt
	if runOpts.Prompt != "" {
		prompt = runOpts.Prompt
	}

	proc, err := claude.StartProcess(ctx, claude.ProcessOptions{
		CLIPath:      ar.cliPath,
		WorkDir:      workDir,
		Model:        agent.Model,
		SystemPrompt: agent.SystemPrompt,
		AllowedTools: agent.AllowedTools,
		Permissions:  agent.Permissions,
		Prompt:       prompt,
		SessionID:    runOpts.SessionID,
	})
	if err != nil {
		return nil, fmt.Errorf("start claude (%s): %w", ar.cliPath, err)
	}

	ar.mu.Lock()
	ar.processes[task.ID] = proc
	ar.mu.Unlock()

	defer func() {
		ar.mu.Lock()
		delete(ar.processes, task.ID)
		ar.mu.Unlock()
	}()

	// Stream events to frontend, track last text for question detection
	eventCount := 0
	var lastText string
	for event := range proc.Events() {
		eventCount++
		if eventCount <= 3 || eventCount%10 == 0 {
			log.Printf("[runner] task %s: event #%d type=%s", task.ID[:8], eventCount, event.Type)
		}

		// Capture Claude session_id from system init event
		if event.Type == "system" && event.SessionID != "" && runOpts.OnSessionID != nil {
			runOpts.OnSessionID(event.SessionID)
		}

		ar.emitTaskEvent(task.ID, event)

		// Track last text content for question detection
		if event.Type == "assistant" {
			text := claude.ExtractTextContent(event)
			if text != "" {
				lastText = text
			}
		}

		// Capture result text
		if event.Type == "result" {
			task.ResultText = event.Result
			if event.Result != "" {
				lastText = event.Result
			}
		}
	}
	log.Printf("[runner] task %s: stream ended after %d events", task.ID[:8], eventCount)

	// Emit done event
	doneEvent := claude.TaskStreamEvent{
		TaskID:  task.ID,
		Type:    "done",
		Content: "Task completed",
		Data: map[string]any{
			"exit_code": proc.ExitCode(),
		},
	}
	ar.bufferEvent(task.ID, doneEvent)
	if ar.wailsCtx != nil {
		wailsRuntime.EventsEmit(ar.wailsCtx, "task:stream", doneEvent)
	}

	if proc.Err() != nil {
		stderrOutput := proc.Stderr()
		if stderrOutput != "" {
			return nil, fmt.Errorf("claude process: %w\nstderr: %s", proc.Err(), stderrOutput)
		}
		return nil, fmt.Errorf("claude process: %w", proc.Err())
	}

	// Detect if the agent's output indicates it needs user input
	result := &RunResult{
		LastText:   lastText,
		NeedsInput: detectNeedsInput(lastText),
	}
	return result, nil
}

// detectNeedsInput checks if the agent's last output looks like it's asking for user input.
// Only checks the last paragraph to avoid false positives from questions in the middle of output.
func detectNeedsInput(text string) bool {
	if text == "" {
		return false
	}
	trimmed := strings.TrimSpace(text)

	// Only look at the last paragraph (after last double newline) to reduce false positives.
	// Agents often have questions mid-output but the final paragraph is what matters.
	if idx := strings.LastIndex(trimmed, "\n\n"); idx >= 0 {
		trimmed = strings.TrimSpace(trimmed[idx:])
	}

	// Check if the last paragraph ends with a question mark
	if strings.HasSuffix(trimmed, "?") {
		return true
	}

	lower := strings.ToLower(trimmed)

	// Common patterns indicating the agent wants approval/input (checked in last paragraph only)
	inputPatterns := []string{
		"approve", "approval", "onay",
		"ready for review", "ready to proceed",
		"which option", "hangi seçenek", "hangisini",
		"should i proceed", "devam edeyim mi",
		"waiting for", "bekliyor",
		"please confirm", "lütfen onaylayın",
		"let me know", "bana bildirin",
		"what do you think", "ne düşünüyorsun",
		"do you want", "ister misin",
		"select one", "birini seç",
	}
	for _, pattern := range inputPatterns {
		if strings.Contains(lower, pattern) {
			return true
		}
	}

	return false
}

// StopTask kills the Claude process for a specific task.
func (ar *AgentRunner) StopTask(taskID string) error {
	ar.mu.RLock()
	proc, ok := ar.processes[taskID]
	ar.mu.RUnlock()

	if !ok {
		return fmt.Errorf("no running process for task %s", taskID)
	}
	return proc.Kill()
}

// IsRunning checks if a task has a running process.
func (ar *AgentRunner) IsRunning(taskID string) bool {
	ar.mu.RLock()
	defer ar.mu.RUnlock()
	_, ok := ar.processes[taskID]
	return ok
}

// RunningCount returns the number of currently running processes.
func (ar *AgentRunner) RunningCount() int {
	ar.mu.RLock()
	defer ar.mu.RUnlock()
	return len(ar.processes)
}

// StopAll kills all running processes.
func (ar *AgentRunner) StopAll() {
	ar.mu.RLock()
	procs := make([]*claude.Process, 0, len(ar.processes))
	for _, p := range ar.processes {
		procs = append(procs, p)
	}
	ar.mu.RUnlock()

	for _, p := range procs {
		if err := p.Kill(); err != nil {
			log.Printf("error killing process: %v", err)
		}
	}
}

func (ar *AgentRunner) emitTaskEvent(taskID string, event claude.StreamEvent) {
	taskEvent := claude.TaskStreamEvent{
		TaskID: taskID,
	}

	switch event.Type {
	case "system":
		taskEvent.Type = "init"
		taskEvent.Content = fmt.Sprintf("Session initialized: %s", event.SessionID)
	case "assistant":
		text := claude.ExtractTextContent(event)
		toolName, toolInput := claude.ExtractToolInfo(event)
		if toolName != "" {
			taskEvent.Type = "tool_use"
			taskEvent.Content = fmt.Sprintf("[%s] %s", toolName, toolInput)
		} else if text != "" {
			taskEvent.Type = "text"
			taskEvent.Content = text
		} else {
			return // skip empty events
		}
	case "result":
		taskEvent.Type = "result"
		taskEvent.Content = event.Result
		taskEvent.Data = map[string]any{
			"duration_ms": event.DurationMS,
			"num_turns":   event.NumTurns,
		}
	default:
		taskEvent.Type = event.Type
		taskEvent.Content = claude.ExtractTextContent(event)
		if taskEvent.Content == "" {
			return
		}
	}

	// Buffer event for later retrieval
	ar.bufferEvent(taskID, taskEvent)

	// Emit to frontend via Wails
	if ar.wailsCtx != nil {
		wailsRuntime.EventsEmit(ar.wailsCtx, "task:stream", taskEvent)
	}
}
