package services

import (
	"agent-workflow/backend/models"
	"agent-workflow/backend/store"
	"fmt"
	"os/exec"
	"path/filepath"
)

// SessionManager handles session lifecycle and change application.
type SessionManager struct {
	sessions   *store.SessionStore
	tasks      *store.TaskStore
	projectMgr *ProjectManager
}

func NewSessionManager(sessions *store.SessionStore, tasks *store.TaskStore, projectMgr *ProjectManager) *SessionManager {
	return &SessionManager{
		sessions:   sessions,
		tasks:      tasks,
		projectMgr: projectMgr,
	}
}

// ApplyTaskChanges copies the changed files from a task workspace back to the original project.
func (sm *SessionManager) ApplyTaskChanges(taskID string, projectPath string) error {
	task, err := sm.tasks.GetByID(taskID)
	if err != nil {
		return fmt.Errorf("task not found: %w", err)
	}
	if task.WorkspacePath == "" {
		return fmt.Errorf("task has no workspace")
	}
	if task.Status != models.TaskStatusCompleted {
		return fmt.Errorf("can only apply changes from completed tasks")
	}

	// Copy changed files back to project using rsync
	cmd := exec.Command("rsync", "-a", "--delete",
		task.WorkspacePath+"/",
		projectPath+"/",
	)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("apply changes: %w", err)
	}

	return nil
}

// ApplySpecificFiles copies only specific files from workspace to project.
func (sm *SessionManager) ApplySpecificFiles(taskID string, projectPath string, files []string) error {
	task, err := sm.tasks.GetByID(taskID)
	if err != nil {
		return fmt.Errorf("task not found: %w", err)
	}
	if task.WorkspacePath == "" {
		return fmt.Errorf("task has no workspace")
	}

	for _, file := range files {
		src := filepath.Join(task.WorkspacePath, file)
		dst := filepath.Join(projectPath, file)

		cmd := exec.Command("cp", "-a", src, dst)
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("copy %s: %w", file, err)
		}
	}

	return nil
}

// RejectTaskChanges cleans up the workspace for a rejected task.
func (sm *SessionManager) RejectTaskChanges(taskID string) error {
	task, err := sm.tasks.GetByID(taskID)
	if err != nil {
		return fmt.Errorf("task not found: %w", err)
	}
	if task.WorkspacePath == "" {
		return nil
	}

	return sm.projectMgr.CleanupWorkspace(task.SessionID, task.ID)
}
