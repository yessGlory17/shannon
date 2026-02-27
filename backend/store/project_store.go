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

func (s *ProjectStore) ListPaginated(page, pageSize int) (*models.PaginatedResponse, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	var total int64
	if err := s.db.Model(&models.Project{}).Count(&total).Error; err != nil {
		return nil, err
	}
	var projects []models.Project
	offset := (page - 1) * pageSize
	if err := s.db.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&projects).Error; err != nil {
		return nil, err
	}
	return models.NewPaginatedResponse(projects, total, page, pageSize), nil
}

func (s *ProjectStore) Update(p *models.Project) error {
	p.UpdatedAt = time.Now()
	return s.db.Save(p).Error
}

func (s *ProjectStore) Delete(id string) error {
	return s.db.Delete(&models.Project{}, "id = ?", id).Error
}
