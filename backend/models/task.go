package models

import "time"

type Task struct {
	ID              string      `json:"id" gorm:"primaryKey"`
	SessionID       string      `json:"session_id" gorm:"index;index:idx_task_session_status"`
	Title           string      `json:"title"`
	Prompt          string      `json:"prompt"`
	OriginalPrompt  string      `json:"original_prompt,omitempty" gorm:"type:text"` // preserved for retry
	Status          TaskStatus  `json:"status" gorm:"index;index:idx_task_session_status;default:pending"`
	AgentID         string      `json:"agent_id,omitempty"`
	TeamID          string      `json:"team_id,omitempty"`
	Dependencies    StringSlice `json:"dependencies" gorm:"type:text"`
	WorkspacePath   string      `json:"workspace_path,omitempty"`
	MCPConfigPath   string      `json:"mcp_config_path,omitempty"`
	ClaudeSessionID string      `json:"claude_session_id,omitempty"`

	// Retry & Resume
	MaxRetries  int `json:"max_retries" gorm:"default:0"`
	RetryCount  int `json:"retry_count" gorm:"default:0"`
	ResumeCount int `json:"resume_count" gorm:"default:0"`

	// Results
	ExitCode     int         `json:"exit_code"`
	ResultText   string      `json:"result_text,omitempty"`
	FilesChanged StringSlice `json:"files_changed" gorm:"type:text"`

	// Agent interaction - set when agent needs user input to continue
	PendingInputData string `json:"pending_input_data,omitempty" gorm:"type:text"`

	// Test/Build
	TestPassed  *bool  `json:"test_passed,omitempty"`
	TestOutput  string `json:"test_output,omitempty"`
	BuildPassed *bool  `json:"build_passed,omitempty"`
	BuildOutput string `json:"build_output,omitempty"`

	// Timestamps
	CreatedAt   time.Time  `json:"created_at"`
	StartedAt   *time.Time `json:"started_at,omitempty"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`

	Error string `json:"error,omitempty"`
}
