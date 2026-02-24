package store

import (
	"agent-workflow/backend/models"
	"time"

	"github.com/google/uuid"
)

type ProjectStore struct {
	db *DB
}

func NewProjectStore(db *DB) *ProjectStore {
	return &ProjectStore{db: db}
}

func (s *ProjectStore) Create(p *models.Project) error {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	p.CreatedAt = time.Now()
	p.UpdatedAt = time.Now()
	return s.db.Create(p).Error
}

func (s *ProjectStore) GetByID(id string) (*models.Project, error) {
	var p models.Project
	if err := s.db.First(&p, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *ProjectStore) List() ([]models.Project, error) {
	var projects []models.Project
	if err := s.db.Order("created_at DESC").Find(&projects).Error; err != nil {
		return nil, err
	}
	return projects, nil
}

func (s *ProjectStore) Update(p *models.Project) error {
	p.UpdatedAt = time.Now()
	return s.db.Save(p).Error
}

func (s *ProjectStore) Delete(id string) error {
	return s.db.Delete(&models.Project{}, "id = ?", id).Error
}
