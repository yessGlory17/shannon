package store

import (
	"agent-workflow/backend/models"
	"time"

	"github.com/google/uuid"
)

type MCPServerStore struct {
	db *DB
}

func NewMCPServerStore(db *DB) *MCPServerStore {
	return &MCPServerStore{db: db}
}

func (s *MCPServerStore) Create(m *models.MCPServer) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	m.CreatedAt = time.Now()
	m.UpdatedAt = time.Now()
	return s.db.Create(m).Error
}

func (s *MCPServerStore) GetByID(id string) (*models.MCPServer, error) {
	var m models.MCPServer
	if err := s.db.First(&m, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &m, nil
}

func (s *MCPServerStore) List() ([]models.MCPServer, error) {
	var servers []models.MCPServer
	if err := s.db.Order("created_at DESC").Find(&servers).Error; err != nil {
		return nil, err
	}
	return servers, nil
}

func (s *MCPServerStore) ListEnabled() ([]models.MCPServer, error) {
	var servers []models.MCPServer
	if err := s.db.Where("enabled = ?", true).Order("created_at DESC").Find(&servers).Error; err != nil {
		return nil, err
	}
	return servers, nil
}

func (s *MCPServerStore) ListByIDs(ids []string) ([]models.MCPServer, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	var servers []models.MCPServer
	if err := s.db.Where("id IN ?", ids).Find(&servers).Error; err != nil {
		return nil, err
	}
	return servers, nil
}

func (s *MCPServerStore) Update(m *models.MCPServer) error {
	m.UpdatedAt = time.Now()
	return s.db.Save(m).Error
}

func (s *MCPServerStore) Delete(id string) error {
	return s.db.Delete(&models.MCPServer{}, "id = ?", id).Error
}
