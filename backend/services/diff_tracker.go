package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

// DiffHunk represents a single hunk within a unified diff.
type DiffHunk struct {
	Index    int    `json:"index"`
	Header   string `json:"header"`    // @@ -10,7 +10,8 @@
	OldStart int    `json:"old_start"` // start line in original file
	OldCount int    `json:"old_count"` // number of lines from original
	NewStart int    `json:"new_start"` // start line in new file
	NewCount int    `json:"new_count"` // number of lines in new version
	Content  string `json:"content"`   // hunk lines with +/-/space prefixes
}

// FileDiff represents changes to a single file.
type FileDiff struct {
	Path   string     `json:"path"`
	Status string     `json:"status"` // "added", "modified", "deleted", "renamed"
	Diff   string     `json:"diff"`   // unified diff content
	Hunks  []DiffHunk `json:"hunks"`  // parsed structured hunks
}

// DiffResult contains all changes from a task.
type DiffResult struct {
	Files []FileDiff `json:"files"`
	Total int        `json:"total"`
}

// DiffTracker computes file differences using git.
type DiffTracker struct{}

func NewDiffTracker() *DiffTracker {
	return &DiffTracker{}
}

var hunkHeaderRe = regexp.MustCompile(`^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@`)

// ParseHunks parses a unified diff string into structured hunks.
func ParseHunks(unifiedDiff string) []DiffHunk {
	lines := strings.Split(unifiedDiff, "\n")
	var hunks []DiffHunk
	var currentHunk *DiffHunk
	var contentLines []string
	hunkIndex := 0

	for _, line := range lines {
		matches := hunkHeaderRe.FindStringSubmatch(line)
		if matches != nil {
			// Flush previous hunk
			if currentHunk != nil {
				currentHunk.Content = strings.Join(contentLines, "\n")
				hunks = append(hunks, *currentHunk)
			}

			oldStart, _ := strconv.Atoi(matches[1])
			oldCount := 1
			if matches[2] != "" {
				oldCount, _ = strconv.Atoi(matches[2])
			}
			newStart, _ := strconv.Atoi(matches[3])
			newCount := 1
			if matches[4] != "" {
				newCount, _ = strconv.Atoi(matches[4])
			}

			currentHunk = &DiffHunk{
				Index:    hunkIndex,
				Header:   line,
				OldStart: oldStart,
				OldCount: oldCount,
				NewStart: newStart,
				NewCount: newCount,
			}
			contentLines = nil
			hunkIndex++
			continue
		}

		// Skip file headers (--- and +++ lines)
		if strings.HasPrefix(line, "---") || strings.HasPrefix(line, "+++") {
			continue
		}

		// Accumulate content lines if inside a hunk
		if currentHunk != nil {
			contentLines = append(contentLines, line)
		}
	}

	// Flush last hunk
	if currentHunk != nil {
		currentHunk.Content = strings.Join(contentLines, "\n")
		hunks = append(hunks, *currentHunk)
	}

	return hunks
}

// hasGit checks whether the given directory is inside a git repository.
func hasGit(dir string) bool {
	cmd := exec.Command("git", "rev-parse", "--is-inside-work-tree")
	cmd.Dir = dir
	out, err := cmd.Output()
	return err == nil && strings.TrimSpace(string(out)) == "true"
}

// ComputeDiff computes uncommitted changes in a git project directory.
// Uses `git status --porcelain` for file list and `git diff HEAD` for diffs.
// If the directory is not a git repo, returns an empty result.
func (dt *DiffTracker) ComputeDiff(projectPath string) (*DiffResult, error) {
	if !hasGit(projectPath) {
		return &DiffResult{}, nil
	}

	result := &DiffResult{}

	// Get file status list: staged + unstaged + untracked
	cmd := exec.Command("git", "status", "--porcelain", "-uall")
	cmd.Dir = projectPath
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("git status: %w", err)
	}

	statusOutput := strings.TrimSpace(string(out))
	if statusOutput == "" {
		return result, nil
	}

	lines := strings.Split(statusOutput, "\n")
	for _, line := range lines {
		if len(line) < 4 {
			continue
		}

		// git status --porcelain format: XY <path>
		// X = index status, Y = worktree status
		xy := line[:2]
		path := strings.TrimSpace(line[3:])

		// Handle renamed files: "R  old -> new"
		if strings.Contains(path, " -> ") {
			parts := strings.SplitN(path, " -> ", 2)
			path = parts[1]
		}

		var fd FileDiff
		fd.Path = path

		switch {
		case xy == "??" || xy[0] == 'A' || xy[1] == 'A':
			fd.Status = "added"
		case xy[0] == 'D' || xy[1] == 'D':
			fd.Status = "deleted"
		case xy[0] == 'R' || xy[1] == 'R':
			fd.Status = "renamed"
		default:
			fd.Status = "modified"
		}

		// Get unified diff for this file
		if fd.Status != "deleted" {
			fd.Diff = dt.getGitFileDiff(projectPath, path)
			fd.Hunks = ParseHunks(fd.Diff)
		}

		result.Files = append(result.Files, fd)
	}

	result.Total = len(result.Files)
	return result, nil
}

// getGitFileDiff returns the unified diff for a single file.
// For tracked files: git diff HEAD -- <file>
// For untracked (new) files: generates a diff showing all lines as additions.
func (dt *DiffTracker) getGitFileDiff(projectPath, relPath string) string {
	// Try git diff HEAD first (covers staged + unstaged for tracked files)
	cmd := exec.Command("git", "diff", "HEAD", "--", relPath)
	cmd.Dir = projectPath
	out, err := cmd.Output()
	if err == nil && len(out) > 0 {
		return string(out)
	}

	// For untracked files, git diff HEAD won't work. Show content as new file diff.
	fullPath := filepath.Join(projectPath, relPath)
	data, err := os.ReadFile(fullPath)
	if err != nil {
		return ""
	}

	// Build a synthetic unified diff for the new file
	content := string(data)
	lines := strings.Split(content, "\n")
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("--- /dev/null\n+++ b/%s\n", relPath))
	sb.WriteString(fmt.Sprintf("@@ -0,0 +1,%d @@\n", len(lines)))
	for _, line := range lines {
		sb.WriteString("+" + line + "\n")
	}
	return sb.String()
}

// GetChangedFiles returns the list of changed file paths using git.
func (dt *DiffTracker) GetChangedFiles(projectPath string) ([]string, error) {
	result, err := dt.ComputeDiff(projectPath)
	if err != nil {
		return nil, err
	}

	var files []string
	for _, f := range result.Files {
		files = append(files, f.Path)
	}
	return files, nil
}

// RevertHunk reverts a single hunk in the project using reverse patch.
func (dt *DiffTracker) RevertHunk(projectPath, filePath string, hunk DiffHunk) error {
	// Build a minimal unified diff for this single hunk
	patchContent := fmt.Sprintf("--- a/%s\n+++ b/%s\n%s\n%s\n",
		filePath, filePath, hunk.Header, hunk.Content)

	// Apply in reverse to undo the change
	cmd := exec.Command("git", "apply", "--reverse", "--unidiff-zero")
	cmd.Dir = projectPath
	cmd.Stdin = strings.NewReader(patchContent)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git apply --reverse failed: %w (output: %s)", err, string(output))
	}
	return nil
}

// RevertFile restores a single file to its last committed state.
// For untracked files, it removes the file.
func (dt *DiffTracker) RevertFile(projectPath, filePath string) error {
	fullPath := filepath.Join(projectPath, filePath)

	// Check if the file is tracked by git
	cmd := exec.Command("git", "ls-files", "--error-unmatch", filePath)
	cmd.Dir = projectPath
	if err := cmd.Run(); err != nil {
		// Untracked file — just remove it
		return os.Remove(fullPath)
	}

	// Tracked file — restore to HEAD version
	cmd = exec.Command("git", "checkout", "HEAD", "--", filePath)
	cmd.Dir = projectPath
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git checkout failed: %w (output: %s)", err, string(output))
	}

	// Also unstage if it was staged
	cmd = exec.Command("git", "reset", "HEAD", "--", filePath)
	cmd.Dir = projectPath
	cmd.Run() // ignore error — file may not be staged

	return nil
}
