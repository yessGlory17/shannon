package services

import (
	"os"
	"path/filepath"
)

// ProjectManager handles workspace setup for task isolation.
// In the current architecture agents work directly on the project directory,
// so workspace creation is a no-op that simply returns project.Path.
type ProjectManager struct {
	workspacesDir string
}

func NewProjectManager(workspacesDir string) *ProjectManager {
	return &ProjectManager{workspacesDir: workspacesDir}
}

// PrepareWorkDir returns the working directory for a task.
// Agents work directly on the project path — no copy is made.
func (pm *ProjectManager) PrepareWorkDir(projectPath string) string {
	return projectPath
}

// CleanupWorkspace is a no-op since agents work directly on project files.
func (pm *ProjectManager) CleanupWorkspace(sessionID, taskID string) error {
	return nil
}

// CleanupSession is a no-op since agents work directly on project files.
func (pm *ProjectManager) CleanupSession(sessionID string) error {
	return nil
}

// EnsureMCPDir creates the .mcp directory inside a project if needed.
// Returns the .mcp.json path.
func (pm *ProjectManager) EnsureMCPDir(projectPath string) (string, error) {
	mcpPath := filepath.Join(projectPath, ".mcp.json")
	return mcpPath, nil
}

// EnsureClaudeDir creates the .claude directory inside a project if needed.
func (pm *ProjectManager) EnsureClaudeDir(projectPath string) error {
	claudeDir := filepath.Join(projectPath, ".claude")
	return os.MkdirAll(claudeDir, 0755)
}
