package models

import "time"

type Project struct {
	ID            string      `json:"id" gorm:"primaryKey"`
	Name          string      `json:"name"`
	Path          string      `json:"path"`
	TestCommand   string      `json:"test_command,omitempty"`
	BuildCommand  string      `json:"build_command,omitempty"`
	SetupCommands StringSlice `json:"setup_commands" gorm:"type:text"`
	ClaudeMD      string      `json:"claude_md,omitempty" gorm:"type:text"` // CLAUDE.md content injected into workspace
	CreatedAt     time.Time   `json:"created_at"`
	UpdatedAt     time.Time   `json:"updated_at"`
}
