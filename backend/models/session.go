package models

import "time"

type Session struct {
	ID          string        `json:"id" gorm:"primaryKey"`
	ProjectID   string        `json:"project_id" gorm:"index;index:idx_session_project_created"`
	Name        string        `json:"name"`
	Status      SessionStatus `json:"status" gorm:"default:planning"`
	CreatedAt   time.Time     `json:"created_at" gorm:"index:idx_session_project_created"`
	StartedAt   *time.Time    `json:"started_at,omitempty"`
	CompletedAt *time.Time    `json:"completed_at,omitempty"`
}
