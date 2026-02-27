package services

import (
	"agent-workflow/backend/store"
	"fmt"
)

// SessionManager handles session lifecycle and change application.
type SessionManager struct {
	sessions    *store.SessionStore
	tasks       *store.TaskStore
	projects    *store.ProjectStore
	projectMgr  *ProjectManager
	diffTracker *DiffTracker
}

func NewSessionManager(sessions *store.SessionStore, tasks *store.TaskStore, projects *store.ProjectStore, projectMgr *ProjectManager, diffTracker *DiffTracker) *SessionManager {
	return &SessionManager{
		sessions:    sessions,
		tasks:       tasks,
		projects:    projects,
		projectMgr:  projectMgr,
		diffTracker: diffTracker,
	}
}

// ApplyTaskChanges is a no-op since agents work directly on the project directory.
// Changes are already in place.
func (sm *SessionManager) ApplyTaskChanges(taskID string, projectPath string) error {
	return nil
}

// ApplySpecificFiles is a no-op since agents work directly on the project directory.
func (sm *SessionManager) ApplySpecificFiles(taskID string, projectPath string, files []string) error {
	return nil
}

// RejectTaskChanges reverts all uncommitted changes in the project directory using git.
func (sm *SessionManager) RejectTaskChanges(taskID string) error {
	task, err := sm.tasks.GetByID(taskID)
	if err != nil {
		return fmt.Errorf("task not found: %w", err)
	}

	projectPath := task.WorkspacePath
	if projectPath == "" {
		return nil
	}

	// Revert all uncommitted changes for files this task changed
	for _, filePath := range task.FilesChanged {
		if err := sm.diffTracker.RevertFile(projectPath, filePath); err != nil {
			return fmt.Errorf("revert %s: %w", filePath, err)
		}
	}

	return nil
}
