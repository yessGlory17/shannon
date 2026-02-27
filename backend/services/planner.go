package services

import (
	"agent-workflow/backend/claude"
	"agent-workflow/backend/models"
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

// ProposedTask is a task suggested by the AI planner.
type ProposedTask struct {
	Title        string   `json:"title"`
	Prompt       string   `json:"prompt"`
	Dependencies []string `json:"dependencies"` // titles of dependent tasks
	AgentID      string   `json:"agent_id,omitempty"`
}

// PlanResult contains the planner's output.
type PlanResult struct {
	Tasks   []ProposedTask `json:"tasks"`
	Summary string         `json:"summary"`
}

// Planner uses Claude to decompose a high-level goal into concrete tasks.
type Planner struct {
	envVars map[string]string
}

func NewPlanner(envVars map[string]string) *Planner {
	return &Planner{envVars: envVars}
}

// planResultJSONSchema returns the JSON schema for PlanResult to use with --json-schema flag.
func planResultJSONSchema() string {
	return `{
  "type": "object",
  "required": ["summary", "tasks"],
  "properties": {
    "summary": {
      "type": "string",
      "description": "Brief description of the overall plan"
    },
    "tasks": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["title", "prompt"],
        "properties": {
          "title": { "type": "string", "description": "Short task title" },
          "prompt": { "type": "string", "description": "Detailed prompt for the agent" },
          "dependencies": {
            "type": "array",
            "items": { "type": "string" },
            "description": "Titles of tasks this task depends on"
          },
          "agent_id": { "type": "string", "description": "ID of the assigned agent" }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}`
}

// SetEnvVars updates the environment variables injected into Claude subprocesses.
func (p *Planner) SetEnvVars(envVars map[string]string) {
	p.envVars = envVars
}

// buildAgentsList formats agents into a readable list for the planner prompt.
func buildAgentsList(agents []models.Agent) string {
	if len(agents) == 0 {
		return ""
	}
	var sb strings.Builder
	sb.WriteString("\n\nAvailable agents (assign the most suitable agent to each task using their ID):\n")
	for _, a := range agents {
		sb.WriteString(fmt.Sprintf("- ID: %s | Name: %s | Description: %s\n", a.ID, a.Name, a.Description))
	}
	return sb.String()
}

// PlanTasks analyzes a project and breaks down a goal into tasks.
func (p *Planner) PlanTasks(ctx context.Context, projectPath string, goal string, agents []models.Agent) (*PlanResult, error) {
	agentInfo := buildAgentsList(agents)

	agentRule := ""
	if len(agents) > 0 {
		agentRule = `- For each task, set "agent_id" to the ID of the most suitable agent based on the agent's name and description. Match the task's purpose to the agent's specialization.` + "\n"
	}

	prompt := fmt.Sprintf(`You are a task planner for a software development workflow.

Analyze the project in the current directory and break down this goal into concrete, independent tasks that can be assigned to Claude Code agents.

Goal: %s
%s
Rules:
- Each task should be a self-contained unit of work
- Tasks should be as independent as possible to allow parallel execution
- If a task depends on another, specify the dependency by title
- Each task prompt should be detailed enough for an AI agent to execute without additional context
- Keep task count between 2-8 tasks
%s`, goal, agentInfo, agentRule)

	proc, err := claude.StartProcess(ctx, claude.ProcessOptions{
		WorkDir:     projectPath,
		Model:       "sonnet",
		Prompt:      prompt,
		Permissions: "default",
		JSONSchema:  planResultJSONSchema(),
		Env:         p.envVars,
	})
	if err != nil {
		return nil, fmt.Errorf("start planner: %w", err)
	}

	// Collect all output. With --json-schema, the result event contains validated JSON.
	var resultJSON string
	var assistantText strings.Builder
	for event := range proc.Events() {
		switch event.Type {
		case "result":
			resultJSON = event.Result
		case "assistant":
			text := claude.ExtractTextContent(event)
			if text != "" {
				assistantText.WriteString(text)
			}
		}
	}

	<-proc.Done()

	// Primary path: parse the result event (validated by --json-schema)
	raw := resultJSON
	if raw == "" {
		// Fallback: try assistant text with brace-depth extraction
		raw = extractJSON(assistantText.String())
	}

	var result PlanResult
	if err := json.Unmarshal([]byte(raw), &result); err != nil {
		return nil, fmt.Errorf("parse planner response: %w (raw: %s)", err, truncate(raw, 500))
	}

	if len(result.Tasks) == 0 {
		return nil, fmt.Errorf("planner returned no tasks")
	}

	return &result, nil
}

// extractJSON tries to find a JSON object in potentially noisy text.
func extractJSON(text string) string {
	text = strings.TrimSpace(text)

	// Try to find JSON between { and }
	start := strings.Index(text, "{")
	if start < 0 {
		return text
	}

	depth := 0
	for i := start; i < len(text); i++ {
		switch text[i] {
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return text[start : i+1]
			}
		}
	}

	return text[start:]
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
