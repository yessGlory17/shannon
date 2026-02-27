package store

import (
	"agent-workflow/backend/models"
	"time"

	"github.com/google/uuid"
)

type SessionStore struct {
	db *DB
}

func NewSessionStore(db *DB) *SessionStore {
	return &SessionStore{db: db}
}

func (s *SessionStore) Create(sess *models.Session) error {
	if sess.ID == "" {
		sess.ID = uuid.New().String()
	}
	if sess.Status == "" {
		sess.Status = models.SessionStatusPlanning
	}
	sess.CreatedAt = time.Now()
	return s.db.Create(sess).Error
}

func (s *SessionStore) GetByID(id string) (*models.Session, error) {
	var sess models.Session
	if err := s.db.First(&sess, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &sess, nil
}

func (s *SessionStore) List() ([]models.Session, error) {
	var sessions []models.Session
	if err := s.db.Order("created_at DESC").Find(&sessions).Error; err != nil {
		return nil, err
	}
	return sessions, nil
}

func (s *SessionStore) ListPaginated(page, pageSize int) (*models.PaginatedResponse, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	var total int64
	if err := s.db.Model(&models.Session{}).Count(&total).Error; err != nil {
		return nil, err
	}
	var sessions []models.Session
	offset := (page - 1) * pageSize
	if err := s.db.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&sessions).Error; err != nil {
		return nil, err
	}
	return models.NewPaginatedResponse(sessions, total, page, pageSize), nil
}

func (s *SessionStore) ListByProject(projectID string) ([]models.Session, error) {
	var sessions []models.Session
	if err := s.db.Where("project_id = ?", projectID).Order("created_at DESC").Find(&sessions).Error; err != nil {
		return nil, err
	}
	return sessions, nil
}

func (s *SessionStore) Update(sess *models.Session) error {
	return s.db.Save(sess).Error
}

func (s *SessionStore) UpdateStatus(id string, status models.SessionStatus) error {
	updates := map[string]any{"status": status}
	now := time.Now()
	switch status {
	case models.SessionStatusRunning:
		updates["started_at"] = now
	case models.SessionStatusCompleted, models.SessionStatusFailed:
		updates["completed_at"] = now
	}
	return s.db.Model(&models.Session{}).Where("id = ?", id).Updates(updates).Error
}

func (s *SessionStore) Delete(id string) error {
	return s.db.Delete(&models.Session{}, "id = ?", id).Error
}
