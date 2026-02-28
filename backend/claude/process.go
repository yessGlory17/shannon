package claude

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"sync"
)

// Process wraps a running Claude Code CLI process.
type Process struct {
	cmd    *exec.Cmd
	stdin  io.WriteCloser
	stdout io.ReadCloser
	stderr io.ReadCloser

	events    chan StreamEvent
	done      chan struct{}
	err       error
	stderrBuf bytes.Buffer
	stderrMu  sync.Mutex
	mu        sync.Mutex
}

// StartProcess spawns a new Claude Code CLI process with the given options.
func StartProcess(ctx context.Context, opts ProcessOptions) (*Process, error) {
	args := buildArgs(opts)

	cliPath := opts.CLIPath
	if cliPath == "" {
		cliPath = "claude"
	}

	log.Printf("[claude] starting: %s %v (workdir: %s)", cliPath, args, opts.WorkDir)

	cmd := exec.CommandContext(ctx, cliPath, args...)
	cmd.Dir = opts.WorkDir

	// Merge extra env vars with parent process environment.
	if len(opts.Env) > 0 {
		cmd.Env = os.Environ()
		for k, v := range opts.Env {
			cmd.Env = append(cmd.Env, k+"="+v)
		}
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("stdout pipe: %w", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, fmt.Errorf("stderr pipe: %w", err)
	}

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, fmt.Errorf("stdin pipe: %w", err)
	}

	p := &Process{
		cmd:    cmd,
		stdin:  stdin,
		stdout: stdout,
		stderr: stderr,
		events: make(chan StreamEvent, 1024),
		done:   make(chan struct{}),
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start process (%s): %w", cliPath, err)
	}

	log.Printf("[claude] process started (pid: %d)", cmd.Process.Pid)

	// Close stdin immediately - we pass prompt via args, not stdin
	stdin.Close()

	// Capture stderr in background for error reporting.
	// This goroutine exits when stderr is closed (process exit) or context is cancelled.
	go func() {
		buf := make([]byte, 4096)
		for {
			n, readErr := stderr.Read(buf)
			if n > 0 {
				p.stderrMu.Lock()
				p.stderrBuf.Write(buf[:n])
				p.stderrMu.Unlock()
				log.Printf("[claude] stderr: %s", string(buf[:n]))
			}
			if readErr != nil {
				break
			}
			// Check if context was cancelled to avoid blocking indefinitely
			select {
			case <-ctx.Done():
				return
			default:
			}
		}
	}()

	// Parse stdout stream events in background
	go func() {
		defer close(p.done)
		defer close(p.events)

		log.Printf("[claude] starting stream parser")

		if parseErr := ParseStreamEvents(stdout, p.events); parseErr != nil {
			log.Printf("[claude] stream parse error: %v", parseErr)
			p.mu.Lock()
			p.err = parseErr
			p.mu.Unlock()
		}

		log.Printf("[claude] stream parser finished")

		// Wait for process to finish
		if waitErr := cmd.Wait(); waitErr != nil {
			log.Printf("[claude] process exited with error: %v", waitErr)
			p.mu.Lock()
			if p.err == nil {
				p.err = waitErr
			}
			p.mu.Unlock()
		} else {
			log.Printf("[claude] process exited cleanly (exit code: %d)", p.ExitCode())
		}

		// Log stderr if there was any output
		stderrOutput := p.Stderr()
		if stderrOutput != "" {
			log.Printf("[claude] full stderr output:\n%s", stderrOutput)
		}
	}()

	return p, nil
}

// Events returns the channel of stream events from this process.
func (p *Process) Events() <-chan StreamEvent {
	return p.events
}

// Done returns a channel that closes when the process finishes.
func (p *Process) Done() <-chan struct{} {
	return p.done
}

// Err returns any error that occurred during process execution.
func (p *Process) Err() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.err
}

// Stderr returns the captured stderr output from the process.
func (p *Process) Stderr() string {
	p.stderrMu.Lock()
	defer p.stderrMu.Unlock()
	return p.stderrBuf.String()
}

// ExitCode returns the process exit code, or -1 if still running.
func (p *Process) ExitCode() int {
	if p.cmd.ProcessState == nil {
		return -1
	}
	return p.cmd.ProcessState.ExitCode()
}

// Kill sends SIGKILL to the process.
func (p *Process) Kill() error {
	if p.cmd.Process == nil {
		return nil
	}
	return p.cmd.Process.Kill()
}

func buildArgs(opts ProcessOptions) []string {
	args := []string{
		"-p",
		"--output-format", "stream-json",
		"--verbose",
	}

	isResume := opts.SessionID != ""

	// Resume an existing Claude conversation
	if isResume {
		args = append(args, "--resume", opts.SessionID)
	}

	// Always pass --model so the CLI can resolve the correct inference profile
	// (e.g., Bedrock requires inference profile IDs, not foundation model IDs).
	// On resume, this overrides the model stored in the session file.
	if opts.Model != "" {
		args = append(args, "--model", opts.Model)
	}

	// System prompt, allowed/disallowed tools only apply to new sessions.
	// Resumed sessions already have these from the original session.
	if !isResume {
		if opts.SystemPrompt != "" {
			args = append(args, "--system-prompt", opts.SystemPrompt)
		}

		if len(opts.AllowedTools) > 0 {
			for _, tool := range opts.AllowedTools {
				args = append(args, "--allowedTools", tool)
			}
		}

		if len(opts.DisallowedTools) > 0 {
			for _, tool := range opts.DisallowedTools {
				args = append(args, "--disallowedTools", tool)
			}
		}
	}

	// JSON schema for validated structured output.
	if opts.JSONSchema != "" {
		args = append(args, "--json-schema", opts.JSONSchema)
	}

	// Explicit MCP config file path — more reliable than auto-discovery.
	if opts.MCPConfigPath != "" {
		args = append(args, "--mcp-config", opts.MCPConfigPath)
	}

	// In -p (print/non-interactive) mode, stdin is closed so interactive
	// permission approval is impossible. Always use --dangerously-skip-permissions
	// to ensure all tools (Bash, Read, Write, Edit, etc.) can execute.
	// Without this, modes like "acceptEdits" would silently reject Bash/Read
	// calls since there's no stdin to approve them.
	args = append(args, "--dangerously-skip-permissions")

	// Prompt is the final positional argument.
	// Use "--" to end option parsing so the prompt text isn't misread as a flag.
	if opts.Prompt != "" {
		args = append(args, "--", opts.Prompt)
	}

	return args
}
