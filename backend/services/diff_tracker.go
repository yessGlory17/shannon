package services

import (
	"fmt"
	"os"
	"os/exec"
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
	Status string     `json:"status"` // "added", "modified", "deleted"
	Diff   string     `json:"diff"`   // unified diff content
	Hunks  []DiffHunk `json:"hunks"`  // parsed structured hunks
}

// DiffResult contains all changes from a task.
type DiffResult struct {
	Files []FileDiff `json:"files"`
	Total int        `json:"total"`
}

// DiffTracker computes file differences between workspace and original project.
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

// ComputeDiff compares a task workspace against the original project directory.
func (dt *DiffTracker) ComputeDiff(originalPath, workspacePath string) (*DiffResult, error) {
	// Use diff to find changes
	cmd := exec.Command("diff", "-rq", originalPath, workspacePath)
	output, _ := cmd.CombinedOutput() // diff returns exit code 1 when files differ

	result := &DiffResult{}
	lines := strings.Split(strings.TrimSpace(string(output)), "\n")

	for _, line := range lines {
		if line == "" {
			continue
		}

		var fd FileDiff

		if strings.HasPrefix(line, "Only in "+workspacePath) {
			// New file added
			path := extractPath(line, workspacePath)
			fd = FileDiff{Path: path, Status: "added"}
			fd.Diff = getFileDiff(originalPath, workspacePath, path)
			fd.Hunks = ParseHunks(fd.Diff)
		} else if strings.HasPrefix(line, "Only in "+originalPath) {
			// File deleted
			path := extractPath(line, originalPath)
			fd = FileDiff{Path: path, Status: "deleted"}
		} else if strings.Contains(line, " differ") {
			// File modified
			path := extractDifferPath(line, originalPath)
			fd = FileDiff{Path: path, Status: "modified"}
			fd.Diff = getFileDiff(originalPath, workspacePath, path)
			fd.Hunks = ParseHunks(fd.Diff)
		} else {
			continue
		}

		result.Files = append(result.Files, fd)
	}

	result.Total = len(result.Files)
	return result, nil
}

// GetChangedFiles returns the list of changed file paths.
func (dt *DiffTracker) GetChangedFiles(originalPath, workspacePath string) ([]string, error) {
	result, err := dt.ComputeDiff(originalPath, workspacePath)
	if err != nil {
		return nil, err
	}

	var files []string
	for _, f := range result.Files {
		files = append(files, f.Path)
	}
	return files, nil
}

// ApplyHunk applies a single hunk from workspace to the project using patch.
func (dt *DiffTracker) ApplyHunk(projectPath, filePath string, hunk DiffHunk, originalPath string) error {
	origFile := fmt.Sprintf("%s/%s", originalPath, filePath)
	projFile := fmt.Sprintf("%s/%s", projectPath, filePath)

	// Build a minimal unified diff for this single hunk
	patchContent := fmt.Sprintf("--- %s\n+++ %s\n%s\n%s\n",
		origFile, projFile, hunk.Header, hunk.Content)

	cmd := exec.Command("patch", "-p0", "--forward", "--no-backup-if-mismatch")
	cmd.Dir = "/"
	cmd.Stdin = strings.NewReader(patchContent)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("patch apply failed: %w (output: %s)", err, string(output))
	}
	return nil
}

// RevertHunk reverts a single hunk in the workspace using reverse patch.
func (dt *DiffTracker) RevertHunk(workspacePath, filePath string, hunk DiffHunk, originalPath string) error {
	origFile := fmt.Sprintf("%s/%s", originalPath, filePath)
	workFile := fmt.Sprintf("%s/%s", workspacePath, filePath)

	// Build a patch from orig->workspace, then reverse-apply to workspace
	patchContent := fmt.Sprintf("--- %s\n+++ %s\n%s\n%s\n",
		origFile, workFile, hunk.Header, hunk.Content)

	cmd := exec.Command("patch", "-R", "-p0", "--no-backup-if-mismatch")
	cmd.Dir = "/"
	cmd.Stdin = strings.NewReader(patchContent)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("patch revert failed: %w (output: %s)", err, string(output))
	}
	return nil
}

// RevertFile restores a single file in workspace to its original version.
func (dt *DiffTracker) RevertFile(workspacePath, filePath, originalPath string) error {
	origFile := fmt.Sprintf("%s/%s", originalPath, filePath)
	workFile := fmt.Sprintf("%s/%s", workspacePath, filePath)

	data, err := os.ReadFile(origFile)
	if err != nil {
		return fmt.Errorf("read original: %w", err)
	}
	if err := os.WriteFile(workFile, data, 0644); err != nil {
		return fmt.Errorf("write workspace: %w", err)
	}
	return nil
}

func getFileDiff(originalPath, workspacePath, relPath string) string {
	origFile := fmt.Sprintf("%s/%s", originalPath, relPath)
	workFile := fmt.Sprintf("%s/%s", workspacePath, relPath)

	cmd := exec.Command("diff", "-u", origFile, workFile)
	output, _ := cmd.CombinedOutput()
	return string(output)
}

func extractPath(line, basePath string) string {
	// "Only in /path/to/dir: filename" -> relative path
	prefix := "Only in "
	rest := strings.TrimPrefix(line, prefix)
	parts := strings.SplitN(rest, ": ", 2)
	if len(parts) != 2 {
		return line
	}
	dir := strings.TrimPrefix(parts[0], basePath+"/")
	if dir == parts[0] {
		dir = strings.TrimPrefix(parts[0], basePath)
	}
	if dir == "" {
		return parts[1]
	}
	return dir + "/" + parts[1]
}

func extractDifferPath(line, basePath string) string {
	// "Files /orig/path and /work/path differ" -> relative path
	parts := strings.Split(line, " and ")
	if len(parts) < 2 {
		return line
	}
	origPath := strings.TrimPrefix(parts[0], "Files ")
	return strings.TrimPrefix(origPath, basePath+"/")
}
