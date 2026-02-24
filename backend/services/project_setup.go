package services

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ProjectType represents a detected project language/framework.
type ProjectType struct {
	Name       string   `json:"name"`
	Indicators []string `json:"indicators"`
}

// ProjectSetupStatus is the result of inspecting a project directory.
type ProjectSetupStatus struct {
	HasGit           bool        `json:"has_git"`
	HasCommits       bool        `json:"has_commits"`
	HasGitignore     bool        `json:"has_gitignore"`
	CurrentBranch    string      `json:"current_branch"`
	IsCleanTree      bool        `json:"is_clean_tree"`
	UntrackedCount   int         `json:"untracked_count"`
	UncommittedCount int         `json:"uncommitted_count"`
	DetectedType     ProjectType `json:"detected_type"`
	IsReady          bool        `json:"is_ready"`
}

// SetupAction represents what the user wants the setup to do.
type SetupAction struct {
	InitGit       bool `json:"init_git"`
	CreateIgnore  bool `json:"create_gitignore"`
	InitialCommit bool `json:"initial_commit"`
}

// SetupStepEvent is emitted to the frontend during setup execution.
type SetupStepEvent struct {
	Step    string `json:"step"`
	Status  string `json:"status"`
	Message string `json:"message"`
}

// ProjectSetup handles git initialization and project readiness checks.
type ProjectSetup struct {
	wailsCtx context.Context
}

func NewProjectSetup() *ProjectSetup {
	return &ProjectSetup{}
}

func (ps *ProjectSetup) SetWailsContext(ctx context.Context) {
	ps.wailsCtx = ctx
}

// CheckStatus inspects the project directory and returns its current git/setup state.
// This is a read-only operation — it never modifies anything.
func (ps *ProjectSetup) CheckStatus(projectPath string) (*ProjectSetupStatus, error) {
	info, err := os.Stat(projectPath)
	if err != nil {
		return nil, fmt.Errorf("check path: %w", err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("path is not a directory: %s", projectPath)
	}

	status := &ProjectSetupStatus{}

	// Check .git existence
	gitDir := filepath.Join(projectPath, ".git")
	if fi, err := os.Stat(gitDir); err == nil && fi.IsDir() {
		status.HasGit = true
	}

	// Check .gitignore existence
	ignorePath := filepath.Join(projectPath, ".gitignore")
	if _, err := os.Stat(ignorePath); err == nil {
		status.HasGitignore = true
	}

	// Detect project type
	status.DetectedType = ps.detectProjectType(projectPath)

	// If git exists, gather git-specific info
	if status.HasGit {
		// Has commits?
		cmd := exec.Command("git", "rev-parse", "HEAD")
		cmd.Dir = projectPath
		if err := cmd.Run(); err == nil {
			status.HasCommits = true
		}

		// Current branch
		cmd = exec.Command("git", "rev-parse", "--abbrev-ref", "HEAD")
		cmd.Dir = projectPath
		if out, err := cmd.Output(); err == nil {
			status.CurrentBranch = strings.TrimSpace(string(out))
		}

		// Clean working tree?
		cmd = exec.Command("git", "status", "--porcelain")
		cmd.Dir = projectPath
		if out, err := cmd.Output(); err == nil {
			trimmed := strings.TrimSpace(string(out))
			if trimmed == "" {
				status.IsCleanTree = true
			} else {
				lines := strings.Split(trimmed, "\n")
				for _, line := range lines {
					if strings.HasPrefix(line, "??") {
						status.UntrackedCount++
					} else {
						status.UncommittedCount++
					}
				}
			}
		}
	}

	status.IsReady = status.HasGit && status.HasCommits && status.HasGitignore

	return status, nil
}

// RunSetup executes the requested setup actions.
// Emits "project:setup" events at each step for the frontend.
func (ps *ProjectSetup) RunSetup(projectPath string, action SetupAction) error {
	// Step 1: git init
	if action.InitGit {
		// Safety: only init if .git does not exist
		gitDir := filepath.Join(projectPath, ".git")
		if fi, err := os.Stat(gitDir); err != nil || !fi.IsDir() {
			ps.emitStep("git_init", "running", "Initializing git repository...")
			cmd := exec.Command("git", "init")
			cmd.Dir = projectPath
			if out, err := cmd.CombinedOutput(); err != nil {
				ps.emitStep("git_init", "failed", fmt.Sprintf("git init failed: %s", string(out)))
				return fmt.Errorf("git init: %w", err)
			}
			ps.emitStep("git_init", "completed", "Git repository initialized")
		} else {
			ps.emitStep("git_init", "skipped", "Git already initialized")
		}
	} else {
		ps.emitStep("git_init", "skipped", "Git initialization skipped")
	}

	// Step 2: .gitignore
	if action.CreateIgnore {
		ignorePath := filepath.Join(projectPath, ".gitignore")
		if _, err := os.Stat(ignorePath); os.IsNotExist(err) {
			ps.emitStep("gitignore", "running", "Creating .gitignore...")
			projectType := ps.detectProjectType(projectPath)
			content := ps.gitignoreTemplate(projectType.Name)
			if err := os.WriteFile(ignorePath, []byte(content), 0644); err != nil {
				ps.emitStep("gitignore", "failed", fmt.Sprintf("Failed to create .gitignore: %v", err))
				return fmt.Errorf("create .gitignore: %w", err)
			}
			ps.emitStep("gitignore", "completed", fmt.Sprintf(".gitignore created for %s project", projectType.Name))
		} else {
			ps.emitStep("gitignore", "skipped", ".gitignore already exists")
		}
	} else {
		ps.emitStep("gitignore", "skipped", ".gitignore creation skipped")
	}

	// Step 3: Initial commit
	if action.InitialCommit {
		ps.emitStep("initial_commit", "running", "Creating initial commit...")

		// git add .
		cmd := exec.Command("git", "add", ".")
		cmd.Dir = projectPath
		if out, err := cmd.CombinedOutput(); err != nil {
			ps.emitStep("initial_commit", "failed", fmt.Sprintf("git add failed: %s", string(out)))
			return fmt.Errorf("git add: %w", err)
		}

		// Check if there is anything to commit
		cmd = exec.Command("git", "status", "--porcelain")
		cmd.Dir = projectPath
		out, _ := cmd.Output()
		if strings.TrimSpace(string(out)) == "" {
			ps.emitStep("initial_commit", "skipped", "Nothing to commit, working tree clean")
		} else {
			cmd = exec.Command("git", "commit", "-m", "Initial commit")
			cmd.Dir = projectPath
			if out, err := cmd.CombinedOutput(); err != nil {
				ps.emitStep("initial_commit", "failed", fmt.Sprintf("git commit failed: %s", string(out)))
				return fmt.Errorf("git commit: %w", err)
			}
			ps.emitStep("initial_commit", "completed", "Initial commit created")
		}
	} else {
		ps.emitStep("initial_commit", "skipped", "Initial commit skipped")
	}

	ps.emitStep("done", "completed", "Project setup complete")
	return nil
}

// detectProjectType scans for known project marker files.
func (ps *ProjectSetup) detectProjectType(projectPath string) ProjectType {
	markers := []struct {
		typeName string
		files    []string
	}{
		{"go", []string{"go.mod"}},
		{"node", []string{"package.json"}},
		{"python", []string{"requirements.txt", "pyproject.toml", "setup.py", "Pipfile"}},
		{"rust", []string{"Cargo.toml"}},
		{"java", []string{"pom.xml", "build.gradle", "build.gradle.kts"}},
		{"php", []string{"composer.json"}},
		{"ruby", []string{"Gemfile"}},
	}

	for _, m := range markers {
		var found []string
		for _, f := range m.files {
			if _, err := os.Stat(filepath.Join(projectPath, f)); err == nil {
				found = append(found, f)
			}
		}
		if len(found) > 0 {
			return ProjectType{Name: m.typeName, Indicators: found}
		}
	}

	return ProjectType{Name: "unknown"}
}

// gitignoreTemplate returns a .gitignore template for the given project type.
func (ps *ProjectSetup) gitignoreTemplate(projectType string) string {
	base := `# OS files
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/
*.swp
*.swo
*~

# Environment
.env
.env.local
`

	switch projectType {
	case "go":
		return base + `# Go
bin/
vendor/
*.exe
*.test
*.out
`
	case "node":
		return base + `# Node
node_modules/
dist/
build/
.next/
coverage/
*.tsbuildinfo
`
	case "python":
		return base + `# Python
__pycache__/
*.py[cod]
*$py.class
*.egg-info/
dist/
build/
.venv/
venv/
.tox/
`
	case "rust":
		return base + `# Rust
target/
Cargo.lock
`
	case "java":
		return base + `# Java
target/
build/
*.class
*.jar
*.war
.gradle/
`
	case "php":
		return base + `# PHP
vendor/
composer.lock
`
	case "ruby":
		return base + `# Ruby
vendor/bundle/
.bundle/
*.gem
`
	default:
		return base
	}
}

func (ps *ProjectSetup) emitStep(step, status, message string) {
	if ps.wailsCtx != nil {
		wailsRuntime.EventsEmit(ps.wailsCtx, "project:setup", SetupStepEvent{
			Step:    step,
			Status:  status,
			Message: message,
		})
	}
}
