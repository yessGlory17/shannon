package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"
)

type StringSlice []string

func (s StringSlice) Value() (driver.Value, error) {
	if s == nil {
		return "[]", nil
	}
	b, err := json.Marshal(s)
	return string(b), err
}

func (s *StringSlice) Scan(value any) error {
	if value == nil {
		*s = StringSlice{}
		return nil
	}
	var bytes []byte
	switch v := value.(type) {
	case string:
		bytes = []byte(v)
	case []byte:
		bytes = v
	}
	return json.Unmarshal(bytes, s)
}

// StringMap is a map[string]string that serializes to JSON for GORM storage.
type StringMap map[string]string

func (m StringMap) Value() (driver.Value, error) {
	if m == nil {
		return "{}", nil
	}
	b, err := json.Marshal(m)
	return string(b), err
}

func (m *StringMap) Scan(value any) error {
	if value == nil {
		*m = StringMap{}
		return nil
	}
	var bytes []byte
	switch v := value.(type) {
	case string:
		bytes = []byte(v)
	case []byte:
		bytes = v
	}
	return json.Unmarshal(bytes, m)
}

type Agent struct {
	ID           string      `json:"id" gorm:"primaryKey"`
	Name         string      `json:"name"`
	Description  string      `json:"description"`
	Model        string      `json:"model"`
	SystemPrompt string      `json:"system_prompt"`
	AllowedTools StringSlice `json:"allowed_tools" gorm:"type:text"`
	MCPServerIDs StringSlice `json:"mcp_server_ids" gorm:"type:text"`
	Permissions  string      `json:"permissions"`
	CreatedAt    time.Time   `json:"created_at"`
	UpdatedAt    time.Time   `json:"updated_at"`
}
