package store

import (
	"agent-workflow/backend/models"
	"time"

	"github.com/google/uuid"
)

type TaskStore struct {
	db *DB
}

func NewTaskStore(db *DB) *TaskStore {
	return &TaskStore{db: db}
}

func (s *TaskStore) Create(t *models.Task) error {
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	if t.Status == "" {
		t.Status = models.TaskStatusPending
	}
	t.CreatedAt = time.Now()
	return s.db.Create(t).Error
}

func (s *TaskStore) GetByID(id string) (*models.Task, error) {
	var t models.Task
	if err := s.db.First(&t, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &t, nil
}

func (s *TaskStore) ListBySession(sessionID string) ([]models.Task, error) {
	var tasks []models.Task
	if err := s.db.Where("session_id = ?", sessionID).Order("created_at ASC").Find(&tasks).Error; err != nil {
		return nil, err
	}
	return tasks, nil
}

func (s *TaskStore) Update(t *models.Task) error {
	return s.db.Save(t).Error
}

func (s *TaskStore) Delete(id string) error {
	return s.db.Delete(&models.Task{}, "id = ?", id).Error
}

func (s *TaskStore) UpdateStatus(id string, status models.TaskStatus) error {
	updates := map[string]any{"status": status}
	now := time.Now()
	switch status {
	case models.TaskStatusRunning:
		updates["started_at"] = now
	case models.TaskStatusCompleted, models.TaskStatusFailed, models.TaskStatusCancelled:
		updates["completed_at"] = now
	}
	return s.db.Model(&models.Task{}).Where("id = ?", id).Updates(updates).Error
}
