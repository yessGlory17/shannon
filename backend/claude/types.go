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
	DurationMS       float64         `json:"duration_ms,omitempty"`
	NumTurns         int             `json:"num_turns,omitempty"`
	Result           json.RawMessage `json:"result,omitempty"`
	StructuredOutput json.RawMessage `json:"structured_output,omitempty"` // --json-schema validated output

	// Raw JSON for anything we don't parse
	Raw json.RawMessage `json:"-"`
}

// ResultText returns the result as a usable string.
// Priority: structured_output (from --json-schema) > result field.
// If the value is a JSON string, it unwraps the quotes.
// If it's a JSON object/array, it returns the raw JSON.
func (e StreamEvent) ResultText() string {
	// Prefer structured_output when available (--json-schema validated output)
	if len(e.StructuredOutput) > 0 {
		return string(e.StructuredOutput)
	}
	if len(e.Result) == 0 {
		return ""
	}
	var s string
	if err := json.Unmarshal(e.Result, &s); err == nil {
		return s
	}
	return string(e.Result)
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
	CLIPath         string // path to claude CLI binary, defaults to "claude"
	WorkDir         string
	Model           string
	SystemPrompt    string
	AllowedTools    []string
	DisallowedTools []string // tools to deny (e.g., "Bash(rm *)", "Write(/etc/*)")
	Permissions     string   // "default", "acceptEdits", "bypassPermissions"
	Prompt          string
	SessionID       string            // for resuming sessions
	JSONSchema      string            // JSON schema for validated structured output (--json-schema)
	MCPConfigPath   string            // explicit path to .mcp.json (--mcp-config)
	Env             map[string]string // extra env vars to inject into the subprocess
}

// TaskStreamEvent is sent to the frontend via Wails events.
type TaskStreamEvent struct {
	TaskID  string      `json:"task_id"`
	Type    string      `json:"type"`    // "init", "text", "tool_use", "tool_result", "result", "error", "done"
	Content string      `json:"content"` // human-readable content
	Data    interface{} `json:"data,omitempty"`
}
