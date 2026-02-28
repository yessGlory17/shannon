package claude

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"strings"
)

// ParseStreamEvents reads newline-delimited JSON from reader and sends parsed events to channel.
// Closes the channel when the reader is exhausted or an error occurs.
func ParseStreamEvents(reader io.Reader, events chan<- StreamEvent) error {
	scanner := bufio.NewScanner(reader)
	buf := make([]byte, 0, 1024*1024) // 1MB initial buffer
	scanner.Buffer(buf, 10*1024*1024)  // 10MB max line

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		var event StreamEvent
		if err := json.Unmarshal([]byte(line), &event); err != nil {
			// Store raw line for debugging
			event = StreamEvent{
				Type: "raw",
				Raw:  json.RawMessage(line),
			}
		}

		events <- event
	}

	return scanner.Err()
}

// ExtractTextContent extracts human-readable text from a stream event.
func ExtractTextContent(event StreamEvent) string {
	switch event.Type {
	case "assistant":
		if event.Message != nil && event.Message.Content != nil {
			return extractFromContent(event.Message.Content)
		}
	case "result":
		return event.ResultText()
	case "raw":
		return string(event.Raw)
	}
	return ""
}

// ExtractToolInfo extracts tool name and description from a stream event.
func ExtractToolInfo(event StreamEvent) (name string, description string) {
	if event.Message == nil || event.Message.Content == nil {
		return "", ""
	}

	var blocks []ContentBlock
	if err := json.Unmarshal(event.Message.Content, &blocks); err != nil {
		return "", ""
	}

	for _, block := range blocks {
		if block.Type == "tool_use" {
			inputStr := ""
			if block.Input != nil {
				if b, err := json.Marshal(block.Input); err == nil {
					inputStr = string(b)
					if len(inputStr) > 200 {
						inputStr = inputStr[:200] + "..."
					}
				}
			}
			return block.Name, inputStr
		}
	}
	return "", ""
}

func extractFromContent(raw json.RawMessage) string {
	// Try as string first
	var str string
	if err := json.Unmarshal(raw, &str); err == nil {
		return str
	}

	// Try as array of content blocks
	var blocks []ContentBlock
	if err := json.Unmarshal(raw, &blocks); err == nil {
		var parts []string
		for _, block := range blocks {
			switch block.Type {
			case "text":
				parts = append(parts, block.Text)
			case "tool_use":
				parts = append(parts, fmt.Sprintf("[Tool: %s]", block.Name))
			case "tool_result":
				parts = append(parts, "[Tool Result]")
			}
		}
		return strings.Join(parts, "\n")
	}

	return string(raw)
}
