package store

import (
	"agent-workflow/backend/models"
	"time"

	"github.com/google/uuid"
)

type AgentStore struct {
	db *DB
}

func NewAgentStore(db *DB) *AgentStore {
	return &AgentStore{db: db}
}

func (s *AgentStore) Create(a *models.Agent) error {
	if a.ID == "" {
		a.ID = uuid.New().String()
	}
	if a.Permissions == "" {
		a.Permissions = "acceptEdits"
	}
	if a.Model == "" {
		a.Model = "sonnet"
	}
	a.CreatedAt = time.Now()
	a.UpdatedAt = time.Now()
	return s.db.Create(a).Error
}

func (s *AgentStore) GetByID(id string) (*models.Agent, error) {
	var a models.Agent
	if err := s.db.First(&a, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &a, nil
}

func (s *AgentStore) List() ([]models.Agent, error) {
	var agents []models.Agent
	if err := s.db.Order("created_at DESC").Find(&agents).Error; err != nil {
		return nil, err
	}
	return agents, nil
}

func (s *AgentStore) ListPaginated(page, pageSize int) (*models.PaginatedResponse, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	var total int64
	if err := s.db.Model(&models.Agent{}).Count(&total).Error; err != nil {
		return nil, err
	}
	var agents []models.Agent
	offset := (page - 1) * pageSize
	if err := s.db.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&agents).Error; err != nil {
		return nil, err
	}
	return models.NewPaginatedResponse(agents, total, page, pageSize), nil
}

func (s *AgentStore) Update(a *models.Agent) error {
	a.UpdatedAt = time.Now()
	return s.db.Save(a).Error
}

func (s *AgentStore) Delete(id string) error {
	return s.db.Delete(&models.Agent{}, "id = ?", id).Error
}
