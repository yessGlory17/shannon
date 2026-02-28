package services

import (
	"agent-workflow/backend/claude"
	"agent-workflow/backend/models"
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// AgentRunner manages concurrent Claude Code CLI processes.
type AgentRunner struct {
	processes map[string]*claude.Process // taskID -> process
	mu        sync.RWMutex
	wailsCtx  context.Context
	cliPath   string
	envVars   map[string]string // env vars to inject into Claude subprocesses

	// Event buffer: keeps all emitted events per task for later retrieval
	eventBuf   map[string][]claude.TaskStreamEvent
	eventBufMu sync.RWMutex

	// Async event dispatch queue — decouples event production from Wails emission
	emitQueue chan claude.TaskStreamEvent
	emitOnce  sync.Once
}

func NewAgentRunner(cliPath string, envVars map[string]string) *AgentRunner {
	if cliPath == "" {
		cliPath = "claude"
	}
	return &AgentRunner{
		processes: make(map[string]*claude.Process),
		cliPath:   cliPath,
		envVars:   envVars,
		eventBuf:  make(map[string][]claude.TaskStreamEvent),
		emitQueue: make(chan claude.TaskStreamEvent, 4096),
	}
}

// startEmitLoop starts the background goroutine that drains emitQueue and
// sends events to the Wails frontend. It batches consecutive text events for
// the same task that arrive within a short window to reduce IPC overhead.
func (ar *AgentRunner) startEmitLoop() {
	ar.emitOnce.Do(func() {
		go func() {
			// Batch timer: flush accumulated text after this interval
			const batchWindow = 16 * time.Millisecond
			timer := time.NewTimer(batchWindow)
			timer.Stop()

			var pending *claude.TaskStreamEvent // accumulated text event

			flush := func() {
				if pending == nil {
					return
				}
				if ar.wailsCtx != nil {
					wailsRuntime.EventsEmit(ar.wailsCtx, "task:stream", *pending)
				}
				pending = nil
			}

			for {
				select {
				case evt, ok := <-ar.emitQueue:
					if !ok {
						flush()
						return
					}
					// Batch consecutive text events for the same task
					if evt.Type == "text" && pending != nil && pending.TaskID == evt.TaskID && pending.Type == "text" {
						pending.Content += evt.Content
						continue
					}
					// Different event type or task — flush pending first
					flush()
					if evt.Type == "text" {
						cp := evt
						pending = &cp
						timer.Reset(batchWindow)
						continue
					}
					// Non-text events are dispatched immediately
					if ar.wailsCtx != nil {
						wailsRuntime.EventsEmit(ar.wailsCtx, "task:stream", evt)
					}

				case <-timer.C:
					flush()
				}
			}
		}()
	})
}

// SetEnvVars updates the environment variables injected into Claude subprocesses.
func (ar *AgentRunner) SetEnvVars(envVars map[string]string) {
	ar.mu.Lock()
	defer ar.mu.Unlock()
	ar.envVars = envVars
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

// GetTaskEventCount returns the number of buffered events for a task.
func (ar *AgentRunner) GetTaskEventCount(taskID string) int {
	ar.eventBufMu.RLock()
	defer ar.eventBufMu.RUnlock()
	return len(ar.eventBuf[taskID])
}

// GetTaskEventRange returns a slice of events for a task (start inclusive, end exclusive).
// Clamps to valid bounds. Returns nil if no events exist.
func (ar *AgentRunner) GetTaskEventRange(taskID string, start, end int) []claude.TaskStreamEvent {
	ar.eventBufMu.RLock()
	defer ar.eventBufMu.RUnlock()
	events := ar.eventBuf[taskID]
	if events == nil {
		return nil
	}
	n := len(events)
	if start < 0 {
		start = 0
	}
	if end > n {
		end = n
	}
	if start >= end {
		return nil
	}
	result := make([]claude.TaskStreamEvent, end-start)
	copy(result, events[start:end])
	return result
}

// CleanupTaskEvents removes buffered events for a task.
func (ar *AgentRunner) CleanupTaskEvents(taskID string) {
	ar.eventBufMu.Lock()
	defer ar.eventBufMu.Unlock()
	delete(ar.eventBuf, taskID)
}

// bufferEvent stores an event in the in-memory buffer.
// Caps at 2000 events per task to prevent unbounded memory growth.
func (ar *AgentRunner) bufferEvent(taskID string, event claude.TaskStreamEvent) {
	ar.eventBufMu.Lock()
	defer ar.eventBufMu.Unlock()
	buf := ar.eventBuf[taskID]
	if len(buf) >= 2000 {
		buf = buf[len(buf)-1500:]
	}
	ar.eventBuf[taskID] = append(buf, event)
}

// RunTaskOptions configures a RunTask invocation.
type RunTaskOptions struct {
	SessionID     string                 // Claude session ID for --resume (empty = new session)
	Prompt        string                 // Override task prompt (used for follow-ups)
	MCPConfigPath string                 // Explicit path to .mcp.json for --mcp-config
	OnSessionID   func(sessionID string) // Callback when Claude session_id is received
}

// RunResult carries information about how the task run completed.
type RunResult struct {
	NeedsInput bool   // true if the agent's output indicates it needs user input
	LastText   string // the last text output from the agent (for displaying in the UI)
	EventCount int    // number of stream events received from Claude
	ExitCode   int    // process exit code
	Stderr     string // captured stderr output (useful for diagnosing silent failures)
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
		CLIPath:         ar.cliPath,
		WorkDir:         workDir,
		Model:           agent.Model,
		SystemPrompt:    agent.SystemPrompt,
		AllowedTools:    agent.AllowedTools,
		DisallowedTools: agent.DisallowedTools,
		Permissions:     agent.Permissions,
		Prompt:          prompt,
		SessionID:       runOpts.SessionID,
		MCPConfigPath:   runOpts.MCPConfigPath,
		Env:             ar.envVars,
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

		// Capture result text via lastText — avoid writing directly to task struct
		// to prevent data races. Callers apply ResultText from RunResult.LastText.
		if event.Type == "result" {
			if text := event.ResultText(); text != "" {
				lastText = text
			}
		}
	}
	log.Printf("[runner] task %s: stream ended after %d events", task.ID[:8], eventCount)

	// Emit done event — use async queue for consistency
	doneEvent := claude.TaskStreamEvent{
		TaskID:  task.ID,
		Type:    "done",
		Content: "Task completed",
		Data: map[string]any{
			"exit_code": proc.ExitCode(),
		},
	}
	ar.bufferEvent(task.ID, doneEvent)
	ar.startEmitLoop()
	select {
	case ar.emitQueue <- doneEvent:
	default:
		if ar.wailsCtx != nil {
			wailsRuntime.EventsEmit(ar.wailsCtx, "task:stream", doneEvent)
		}
	}

	stderrOutput := proc.Stderr()

	if proc.Err() != nil {
		if stderrOutput != "" {
			return nil, fmt.Errorf("claude process: %w\nstderr: %s", proc.Err(), stderrOutput)
		}
		return nil, fmt.Errorf("claude process: %w", proc.Err())
	}

	// If we received 0 events, something went wrong — Claude likely failed silently
	if eventCount == 0 {
		errMsg := "claude process produced no output (0 events)"
		if stderrOutput != "" {
			errMsg = fmt.Sprintf("claude process produced no output (0 events)\nstderr: %s", stderrOutput)
		}
		return nil, fmt.Errorf("%s", errMsg)
	}

	// Detect if the agent's output indicates it needs user input
	result := &RunResult{
		LastText:   lastText,
		NeedsInput: detectNeedsInput(lastText),
		EventCount: eventCount,
		ExitCode:   proc.ExitCode(),
		Stderr:     stderrOutput,
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
		taskEvent.Content = event.ResultText()
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

	// Async emit to frontend via Wails — non-blocking
	ar.startEmitLoop()
	select {
	case ar.emitQueue <- taskEvent:
	default:
		// Queue full — emit directly to avoid dropping events
		if ar.wailsCtx != nil {
			wailsRuntime.EventsEmit(ar.wailsCtx, "task:stream", taskEvent)
		}
	}
}
