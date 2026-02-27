package services

import (
	"agent-workflow/backend/claude"
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

// PromptImproveResult contains the improved prompt and explanation.
type PromptImproveResult struct {
	ImprovedPrompt string `json:"improved_prompt"`
	Explanation    string `json:"explanation"`
}

// PromptImprover uses Claude to enhance system prompts.
type PromptImprover struct {
	envVars map[string]string
}

func NewPromptImprover(envVars map[string]string) *PromptImprover {
	return &PromptImprover{envVars: envVars}
}

// promptImproveJSONSchema returns the JSON schema for PromptImproveResult.
func promptImproveJSONSchema() string {
	return `{
  "type": "object",
  "required": ["improved_prompt", "explanation"],
  "properties": {
    "improved_prompt": {
      "type": "string",
      "description": "The full improved system prompt text"
    },
    "explanation": {
      "type": "string",
      "description": "Brief explanation of what was improved and why"
    }
  },
  "additionalProperties": false
}`
}

// SetEnvVars updates the environment variables injected into Claude subprocesses.
func (p *PromptImprover) SetEnvVars(envVars map[string]string) {
	p.envVars = envVars
}

// ImprovePrompt takes a draft system prompt and agent context, then returns
// an improved version with explanation of changes.
func (p *PromptImprover) ImprovePrompt(ctx context.Context, draft string, agentName string, agentDescription string) (*PromptImproveResult, error) {
	metaContext := ""
	if agentName != "" || agentDescription != "" {
		metaContext = fmt.Sprintf(`
Agent context:
- Name: %s
- Description: %s
`, agentName, agentDescription)
	}

	prompt := fmt.Sprintf(`You are an expert at writing system prompts for Claude AI agents.

Your task is to improve the following system prompt draft. The improved prompt should be used as a system prompt for a Claude Code agent that will execute tasks autonomously.
%s
Current draft:
<draft>
%s
</draft>

Improve this system prompt following these principles:
1. Be specific and clear about the agent's role, capabilities, and constraints
2. Use structured XML tags where appropriate (e.g., <instructions>, <rules>, <constraints>, <examples>)
3. Define clear output formats and quality standards
4. Add relevant guardrails and error handling instructions
5. Include edge case handling where appropriate
6. Use markdown formatting for readability within sections
7. Keep the prompt concise but comprehensive - remove fluff, add substance
8. If the draft is empty or very minimal, create a solid starting prompt based on the agent context

Return the improved prompt and explanation.`, metaContext, draft)

	proc, err := claude.StartProcess(ctx, claude.ProcessOptions{
		Model:       "sonnet",
		Prompt:      prompt,
		Permissions: "default",
		JSONSchema:  promptImproveJSONSchema(),
		Env:         p.envVars,
	})
	if err != nil {
		return nil, fmt.Errorf("start prompt improver: %w", err)
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

	var result PromptImproveResult
	if err := json.Unmarshal([]byte(raw), &result); err != nil {
		return nil, fmt.Errorf("parse improver response: %w (raw: %s)", err, truncate(raw, 500))
	}

	if result.ImprovedPrompt == "" {
		return nil, fmt.Errorf("improver returned empty prompt")
	}

	return &result, nil
}
