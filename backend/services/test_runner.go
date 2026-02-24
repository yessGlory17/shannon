package services

import (
	"context"
	"os/exec"
	"time"
)

// TestResult holds the output of a test or build command.
type TestResult struct {
	Passed bool   `json:"passed"`
	Output string `json:"output"`
}

// TestRunner executes test and build commands in a workspace.
type TestRunner struct{}

func NewTestRunner() *TestRunner {
	return &TestRunner{}
}

// RunTest executes the test command in the given directory.
func (tr *TestRunner) RunTest(workDir string, command string) *TestResult {
	if command == "" {
		return nil
	}
	return tr.runCommand(workDir, command)
}

// RunBuild executes the build command in the given directory.
func (tr *TestRunner) RunBuild(workDir string, command string) *TestResult {
	if command == "" {
		return nil
	}
	return tr.runCommand(workDir, command)
}

func (tr *TestRunner) runCommand(workDir, command string) *TestResult {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	cmd := exec.CommandContext(ctx, "sh", "-c", command)
	cmd.Dir = workDir

	output, err := cmd.CombinedOutput()
	passed := err == nil

	return &TestResult{
		Passed: passed,
		Output: string(output),
	}
}
