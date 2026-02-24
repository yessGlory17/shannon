package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"
)

// TeamNode represents an agent placed on the team canvas.
type TeamNode struct {
	AgentID string  `json:"agent_id"`
	X       float64 `json:"x"`
	Y       float64 `json:"y"`
}

// TeamEdge represents a connection between two agents in the team flow.
type TeamEdge struct {
	Source string `json:"source"` // agent_id
	Target string `json:"target"` // agent_id
}

// NodeSlice is a GORM-compatible JSON slice of TeamNode.
type NodeSlice []TeamNode

func (s NodeSlice) Value() (driver.Value, error) {
	if s == nil {
		return "[]", nil
	}
	b, err := json.Marshal(s)
	return string(b), err
}

func (s *NodeSlice) Scan(value interface{}) error {
	if value == nil {
		*s = NodeSlice{}
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

// EdgeSlice is a GORM-compatible JSON slice of TeamEdge.
type EdgeSlice []TeamEdge

func (s EdgeSlice) Value() (driver.Value, error) {
	if s == nil {
		return "[]", nil
	}
	b, err := json.Marshal(s)
	return string(b), err
}

func (s *EdgeSlice) Scan(value interface{}) error {
	if value == nil {
		*s = EdgeSlice{}
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

type Team struct {
	ID          string       `json:"id" gorm:"primaryKey"`
	Name        string       `json:"name"`
	Description string       `json:"description"`
	AgentIDs    StringSlice  `json:"agent_ids" gorm:"type:text"`
	Strategy    TeamStrategy `json:"strategy"`
	Nodes       NodeSlice    `json:"nodes" gorm:"type:text"`
	Edges       EdgeSlice    `json:"edges" gorm:"type:text"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
}
