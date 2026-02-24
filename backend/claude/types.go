package claude

import "encoding/json"

// StreamEvent represents a single event from Claude Code's stream-json output.
// Format: newline-delimited JSON, one object per line.
type StreamEvent struct {
	Type    string `json:"type"`              // "system", "assistant", "user", "result"
	Subtype string `json:"subtype,omitempty"` // "init", "text", "tool_use", "tool_result", "success", "error"

	// For system init events
	SessionID string   `json:"session_id,omitempty"`
	Tools     []string `json:"tools,omitempty"`

	// For assistant/user messages
	Message *Message `json:"message,omitempty"`

	// For result events
	DurationMS float64 `json:"duration_ms,omitempty"`
	NumTurns   int     `json:"num_turns,omitempty"`
	Result     string  `json:"result,omitempty"`

	// Raw JSON for anything we don't parse
	Raw json.RawMessage `json:"-"`
}

// Message represents a Claude message within a stream event.
type Message struct {
	Role    string          `json:"role,omitempty"`
	Content json.RawMessage `json:"content,omitempty"`
	Model   string          `json:"model,omitempty"`
	Usage   *Usage          `json:"usage,omitempty"`
}

// Usage tracks token usage.
type Usage struct {
	InputTokens  int `json:"input_tokens,omitempty"`
	OutputTokens int `json:"output_tokens,omitempty"`
	TotalTokens  int `json:"total_tokens,omitempty"`
}

// ContentBlock represents a content block in a message.
type ContentBlock struct {
	Type  string `json:"type"`            // "text", "tool_use", "tool_result"
	Text  string `json:"text,omitempty"`  // for text blocks
	ID    string `json:"id,omitempty"`    // for tool_use
	Name  string `json:"name,omitempty"`  // tool name
	Input any    `json:"input,omitempty"` // tool input
}

// ProcessOptions configures how to spawn a Claude Code CLI process.
type ProcessOptions struct {
	CLIPath      string // path to claude CLI binary, defaults to "claude"
	WorkDir      string
	Model        string
	SystemPrompt string
	AllowedTools []string
	Permissions  string // "default", "acceptEdits", "bypassPermissions"
	Prompt       string
	SessionID    string // for resuming sessions
}

// TaskStreamEvent is sent to the frontend via Wails events.
type TaskStreamEvent struct {
	TaskID  string      `json:"task_id"`
	Type    string      `json:"type"`    // "init", "text", "tool_use", "tool_result", "result", "error", "done"
	Content string      `json:"content"` // human-readable content
	Data    interface{} `json:"data,omitempty"`
}
