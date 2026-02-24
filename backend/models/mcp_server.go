package models

import "time"

// MCPServer represents a configured MCP (Model Context Protocol) server
// that can be attached to agents and injected into their workspace as .mcp.json.
type MCPServer struct {
	ID          string      `json:"id" gorm:"primaryKey"`
	Name        string      `json:"name"`                          // Display name
	ServerKey   string      `json:"server_key"`                    // Key in .mcp.json (e.g., "github", "gitlab")
	Description string      `json:"description"`
	Command     string      `json:"command"`                       // e.g., "npx", "uvx"
	Args        StringSlice `json:"args" gorm:"type:text"`         // e.g., ["-y", "@modelcontextprotocol/server-github"]
	Env         StringMap   `json:"env" gorm:"type:text"`          // e.g., {"GITHUB_TOKEN": "ghp_..."}
	Enabled     bool        `json:"enabled" gorm:"default:true"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}
