package store

import (
	"agent-workflow/backend/models"
	"time"

	"github.com/google/uuid"
)

type TeamStore struct {
	db *DB
}

func NewTeamStore(db *DB) *TeamStore {
	return &TeamStore{db: db}
}

func (s *TeamStore) Create(t *models.Team) error {
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	if t.Strategy == "" {
		t.Strategy = models.TeamStrategyParallel
	}
	t.CreatedAt = time.Now()
	t.UpdatedAt = time.Now()
	return s.db.Create(t).Error
}

func (s *TeamStore) GetByID(id string) (*models.Team, error) {
	var t models.Team
	if err := s.db.First(&t, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &t, nil
}

func (s *TeamStore) List() ([]models.Team, error) {
	var teams []models.Team
	if err := s.db.Order("created_at DESC").Find(&teams).Error; err != nil {
		return nil, err
	}
	return teams, nil
}

func (s *TeamStore) ListPaginated(page, pageSize int) (*models.PaginatedResponse, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	var total int64
	if err := s.db.Model(&models.Team{}).Count(&total).Error; err != nil {
		return nil, err
	}
	var teams []models.Team
	offset := (page - 1) * pageSize
	if err := s.db.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&teams).Error; err != nil {
		return nil, err
	}
	return models.NewPaginatedResponse(teams, total, page, pageSize), nil
}

func (s *TeamStore) Update(t *models.Team) error {
	t.UpdatedAt = time.Now()
	return s.db.Save(t).Error
}

func (s *TeamStore) Delete(id string) error {
	return s.db.Delete(&models.Team{}, "id = ?", id).Error
}
