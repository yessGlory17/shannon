package models

type TaskStatus string

const (
	TaskStatusPending       TaskStatus = "pending"
	TaskStatusQueued        TaskStatus = "queued"
	TaskStatusRunning       TaskStatus = "running"
	TaskStatusCompleted     TaskStatus = "completed"
	TaskStatusFailed        TaskStatus = "failed"
	TaskStatusCancelled     TaskStatus = "cancelled"
	TaskStatusAwaitingInput TaskStatus = "awaiting_input"
)

type SessionStatus string

const (
	SessionStatusPlanning  SessionStatus = "planning"
	SessionStatusRunning   SessionStatus = "running"
	SessionStatusPaused    SessionStatus = "paused"
	SessionStatusCompleted SessionStatus = "completed"
	SessionStatusFailed    SessionStatus = "failed"
)

type TeamStrategy string

const (
	TeamStrategyParallel   TeamStrategy = "parallel"
	TeamStrategySequential TeamStrategy = "sequential"
	TeamStrategyPlanner    TeamStrategy = "planner"
)
