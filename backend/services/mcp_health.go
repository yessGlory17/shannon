package services

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"
)

// MCPHealthResult is returned from a server health check attempt.
type MCPHealthResult struct {
	Success      bool     `json:"success"`
	ServerName   string   `json:"serverName,omitempty"`
	Version      string   `json:"version,omitempty"`
	Capabilities []string `json:"capabilities,omitempty"`
	Error        string   `json:"error,omitempty"`
	DurationMs   int64    `json:"durationMs"`
}

// MCPHealthChecker tests MCP server configurations by performing
// a JSON-RPC initialize handshake over stdio.
type MCPHealthChecker struct{}

func NewMCPHealthChecker() *MCPHealthChecker {
	return &MCPHealthChecker{}
}

// Check spawns the MCP server process, sends an initialize request via
// JSON-RPC 2.0 over stdio, and validates the response.
//
// To handle npx package downloads that may consume stdin, the checker:
//  1. Starts the process and monitors stderr for npx download activity
//  2. Waits for stderr to go quiet (1s of silence) before sending the request
//  3. If no response within 8s, resends the request (retry)
func (h *MCPHealthChecker) Check(command string, args []string, env map[string]string) *MCPHealthResult {
	start := time.Now()

	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, command, args...)

	// Build environment from current env + provided vars
	cmd.Env = os.Environ()
	for k, v := range env {
		cmd.Env = append(cmd.Env, fmt.Sprintf("%s=%s", k, v))
	}

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return &MCPHealthResult{
			Success:    false,
			Error:      fmt.Sprintf("Failed to create stdin pipe: %v", err),
			DurationMs: time.Since(start).Milliseconds(),
		}
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return &MCPHealthResult{
			Success:    false,
			Error:      fmt.Sprintf("Failed to create stdout pipe: %v", err),
			DurationMs: time.Since(start).Milliseconds(),
		}
	}

	stderrReader, err := cmd.StderrPipe()
	if err != nil {
		return &MCPHealthResult{
			Success:    false,
			Error:      fmt.Sprintf("Failed to create stderr pipe: %v", err),
			DurationMs: time.Since(start).Milliseconds(),
		}
	}

	if err := cmd.Start(); err != nil {
		return &MCPHealthResult{
			Success:    false,
			Error:      fmt.Sprintf("Failed to start server process: %v", err),
			DurationMs: time.Since(start).Milliseconds(),
		}
	}

	defer func() {
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		_ = cmd.Wait()
	}()

	// Collect stderr lines in background and signal when quiet
	var stderrMu sync.Mutex
	var stderrBuf strings.Builder
	stderrQuiet := make(chan struct{}, 1)

	go func() {
		scanner := bufio.NewScanner(stderrReader)
		lastLine := time.Now()
		lineCount := 0

		// Signal quiet when no stderr for 1 second
		go func() {
			for {
				time.Sleep(500 * time.Millisecond)
				stderrMu.Lock()
				elapsed := time.Since(lastLine)
				n := lineCount
				stderrMu.Unlock()

				// If at least 1 second of silence (and process has had time to start)
				if elapsed >= 1*time.Second && n >= 0 {
					select {
					case stderrQuiet <- struct{}{}:
					default:
					}
					return
				}
			}
		}()

		for scanner.Scan() {
			stderrMu.Lock()
			lastLine = time.Now()
			lineCount++
			stderrBuf.WriteString(scanner.Text())
			stderrBuf.WriteByte('\n')
			stderrMu.Unlock()
		}
		// stderr closed — process exiting or server started cleanly
		select {
		case stderrQuiet <- struct{}{}:
		default:
		}
	}()

	// Build JSON-RPC 2.0 initialize request
	initReq := map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "initialize",
		"params": map[string]any{
			"protocolVersion": "2024-11-05",
			"capabilities":   map[string]any{},
			"clientInfo": map[string]any{
				"name":    "agent-workflow",
				"version": "1.0.0",
			},
		},
	}

	reqBytes, err := json.Marshal(initReq)
	if err != nil {
		return &MCPHealthResult{
			Success:    false,
			Error:      fmt.Sprintf("Failed to marshal initialize request: %v", err),
			DurationMs: time.Since(start).Milliseconds(),
		}
	}

	// Wait for stderr to go quiet (npx done downloading) or max 15 seconds
	select {
	case <-stderrQuiet:
		log.Printf("[mcp-health] stderr quiet after %dms, sending initialize", time.Since(start).Milliseconds())
	case <-time.After(15 * time.Second):
		log.Printf("[mcp-health] waited 15s for stderr quiet, sending anyway")
	case <-ctx.Done():
		return h.buildTimeoutResult(start, &stderrMu, &stderrBuf)
	}

	// Start reading responses in background
	responseCh := make(chan *MCPHealthResult, 1)
	go h.readResponses(stdout, responseCh)

	// Send the initialize request as newline-delimited JSON.
	// MCP SDK v1.x uses newline-delimited JSON (not Content-Length framing).
	sendInit := func() error {
		msg := append(reqBytes, '\n')
		if _, err := stdin.Write(msg); err != nil {
			return err
		}
		return nil
	}

	if err := sendInit(); err != nil {
		return h.buildErrorResult(start, &stderrMu, &stderrBuf, fmt.Sprintf("Failed to write request: %v", err))
	}

	// Wait for response, retry if needed
	for attempt := 0; attempt < 3; attempt++ {
		retryDelay := 5 * time.Second
		if attempt > 0 {
			retryDelay = 8 * time.Second
		}

		select {
		case result := <-responseCh:
			result.DurationMs = time.Since(start).Milliseconds()

			if result.Success {
				// Send initialized notification
				h.sendInitializedNotification(stdin, reqBytes)
			} else {
				h.enrichError(result, &stderrMu, &stderrBuf)
			}

			log.Printf("[mcp-health] check %s %v => success=%v, duration=%dms (attempt %d)",
				command, args, result.Success, result.DurationMs, attempt+1)
			return result

		case <-time.After(retryDelay):
			if attempt < 2 {
				log.Printf("[mcp-health] no response after %v, retrying send (attempt %d)", retryDelay, attempt+2)
				_ = sendInit() // retry — previous request may have been consumed by npx
			}

		case <-ctx.Done():
			return h.buildTimeoutResult(start, &stderrMu, &stderrBuf)
		}
	}

	return h.buildTimeoutResult(start, &stderrMu, &stderrBuf)
}

func (h *MCPHealthChecker) sendInitializedNotification(stdin io.Writer, _ []byte) {
	notif := map[string]any{
		"jsonrpc": "2.0",
		"method":  "notifications/initialized",
	}
	notifBytes, _ := json.Marshal(notif)
	notifBytes = append(notifBytes, '\n')
	_, _ = stdin.Write(notifBytes)
}

func (h *MCPHealthChecker) buildErrorResult(start time.Time, mu *sync.Mutex, stderrBuf *strings.Builder, errMsg string) *MCPHealthResult {
	result := &MCPHealthResult{
		Success:    false,
		Error:      errMsg,
		DurationMs: time.Since(start).Milliseconds(),
	}
	h.enrichError(result, mu, stderrBuf)
	return result
}

func (h *MCPHealthChecker) buildTimeoutResult(start time.Time, mu *sync.Mutex, stderrBuf *strings.Builder) *MCPHealthResult {
	result := &MCPHealthResult{
		Success:    false,
		Error:      "Health check timed out — server did not respond to initialize request. Server may use HTTP transport (not stdio).",
		DurationMs: time.Since(start).Milliseconds(),
	}
	h.enrichError(result, mu, stderrBuf)
	return result
}

func (h *MCPHealthChecker) enrichError(result *MCPHealthResult, mu *sync.Mutex, stderrBuf *strings.Builder) {
	mu.Lock()
	stderr := strings.TrimSpace(stderrBuf.String())
	mu.Unlock()

	if stderr != "" {
		// Truncate to last 500 chars for readability
		if len(stderr) > 500 {
			stderr = "..." + stderr[len(stderr)-500:]
		}
		result.Error = fmt.Sprintf("%s\nServer stderr: %s", result.Error, stderr)
	}
}

func (h *MCPHealthChecker) readResponses(stdout io.Reader, responseCh chan<- *MCPHealthResult) {
	reader := bufio.NewReader(stdout)

	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			responseCh <- &MCPHealthResult{
				Success: false,
				Error:   fmt.Sprintf("Failed to read from server: %v", err),
			}
			return
		}

		line = strings.TrimSpace(line)

		// Check if it's a Content-Length header
		if lengthStr, found := strings.CutPrefix(line, "Content-Length:"); found {
			lengthStr = strings.TrimSpace(lengthStr)
			contentLength, err := strconv.Atoi(lengthStr)
			if err != nil {
				continue
			}

			// Read blank line after header
			if _, err = reader.ReadString('\n'); err != nil {
				responseCh <- &MCPHealthResult{
					Success: false,
					Error:   fmt.Sprintf("Failed to read header separator: %v", err),
				}
				return
			}

			// Read content body
			body := make([]byte, contentLength)
			if _, err = io.ReadFull(reader, body); err != nil {
				responseCh <- &MCPHealthResult{
					Success: false,
					Error:   fmt.Sprintf("Failed to read response body: %v", err),
				}
				return
			}

			result := parseInitializeResponse(body)
			if result != nil {
				responseCh <- result
				return
			}
			continue
		}

		// Try parsing as newline-delimited JSON (fallback)
		if line != "" {
			result := parseInitializeResponse([]byte(line))
			if result != nil {
				responseCh <- result
				return
			}
		}
	}
}

func parseInitializeResponse(data []byte) *MCPHealthResult {
	var resp struct {
		ID     any `json:"id"`
		Result *struct {
			ProtocolVersion string `json:"protocolVersion"`
			ServerInfo      struct {
				Name    string `json:"name"`
				Version string `json:"version"`
			} `json:"serverInfo"`
			Capabilities map[string]any `json:"capabilities"`
		} `json:"result"`
		Error *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.Unmarshal(data, &resp); err != nil {
		return nil
	}

	if resp.ID == nil {
		return nil
	}

	if resp.Error != nil {
		return &MCPHealthResult{
			Success: false,
			Error:   fmt.Sprintf("Server returned error: %s (code: %d)", resp.Error.Message, resp.Error.Code),
		}
	}

	if resp.Result == nil {
		return nil
	}

	caps := make([]string, 0, len(resp.Result.Capabilities))
	for k := range resp.Result.Capabilities {
		caps = append(caps, k)
	}

	return &MCPHealthResult{
		Success:      true,
		ServerName:   resp.Result.ServerInfo.Name,
		Version:      resp.Result.ServerInfo.Version,
		Capabilities: caps,
	}
}
