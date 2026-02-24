package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// ProjectManager handles workspace creation and file operations for task isolation.
type ProjectManager struct {
	workspacesDir string
}

func NewProjectManager(workspacesDir string) *ProjectManager {
	return &ProjectManager{workspacesDir: workspacesDir}
}

// CreateWorkspace copies the project directory to an isolated workspace for a task.
// Uses cp --reflink=auto for copy-on-write efficiency on supported filesystems.
func (pm *ProjectManager) CreateWorkspace(projectPath, sessionID, taskID string) (string, error) {
	destDir := filepath.Join(pm.workspacesDir, sessionID)
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return "", fmt.Errorf("create workspace dir: %w", err)
	}

	destPath := filepath.Join(destDir, taskID)

	// Remove existing workspace to avoid cp creating nested directories
	os.RemoveAll(destPath)

	// Try with reflink first (copy-on-write)
	cmd := exec.Command("cp", "-a", "--reflink=auto", projectPath, destPath)
	out, err := cmd.CombinedOutput()
	if err != nil {
		// Fallback to regular copy
		cmd = exec.Command("cp", "-a", projectPath, destPath)
		out, err = cmd.CombinedOutput()
		if err != nil {
			return "", fmt.Errorf("copy project: %w (output: %s)", err, string(out))
		}
	}

	// Verify workspace was created correctly
	if _, statErr := os.Stat(destPath); statErr != nil {
		return "", fmt.Errorf("workspace not created at %s: %w", destPath, statErr)
	}

	return destPath, nil
}

// CleanupWorkspace removes a task's workspace.
func (pm *ProjectManager) CleanupWorkspace(sessionID, taskID string) error {
	destPath := filepath.Join(pm.workspacesDir, sessionID, taskID)
	return os.RemoveAll(destPath)
}

// CleanupSession removes all workspaces for a session.
func (pm *ProjectManager) CleanupSession(sessionID string) error {
	destDir := filepath.Join(pm.workspacesDir, sessionID)
	return os.RemoveAll(destDir)
}
