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
type PromptImprover struct{}

func NewPromptImprover() *PromptImprover {
	return &PromptImprover{}
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

Respond ONLY with a JSON object in this exact format (no markdown, no explanation outside JSON):
{"improved_prompt": "the full improved system prompt text", "explanation": "brief explanation of what was improved and why"}`, metaContext, draft)

	proc, err := claude.StartProcess(ctx, claude.ProcessOptions{
		Model:       "sonnet",
		Prompt:      prompt,
		Permissions: "default",
	})
	if err != nil {
		return nil, fmt.Errorf("start prompt improver: %w", err)
	}

	// Collect all output
	var resultText strings.Builder
	for event := range proc.Events() {
		switch event.Type {
		case "result":
			resultText.WriteString(event.Result)
		case "assistant":
			text := claude.ExtractTextContent(event)
			if text != "" {
				resultText.WriteString(text)
			}
		}
	}

	<-proc.Done()

	// Parse JSON response
	raw := resultText.String()
	raw = extractJSON(raw)

	var result PromptImproveResult
	if err := json.Unmarshal([]byte(raw), &result); err != nil {
		return nil, fmt.Errorf("parse improver response: %w (raw: %s)", err, truncate(raw, 500))
	}

	if result.ImprovedPrompt == "" {
		return nil, fmt.Errorf("improver returned empty prompt")
	}

	return &result, nil
}
