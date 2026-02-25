package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// CatalogItem represents a server from the Smithery registry.
type CatalogItem struct {
	ID            string         `json:"id"`
	QualifiedName string         `json:"qualifiedName"`
	DisplayName   string         `json:"displayName"`
	Description   string         `json:"description"`
	IconURL       string         `json:"iconUrl"`
	Verified      bool           `json:"verified"`
	UseCount      int            `json:"useCount"`
	Homepage      string         `json:"homepage"`
	CreatedAt     string         `json:"createdAt"`
	InstallConfig *InstallConfig `json:"installConfig,omitempty"`
}

type InstallConfig struct {
	Command string      `json:"command"`
	Args    []string    `json:"args"`
	EnvVars []EnvVarDef `json:"envVars"`
	DocURL  string      `json:"docUrl,omitempty"`
}

type EnvVarDef struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Required    bool   `json:"required"`
	Placeholder string `json:"placeholder,omitempty"`
}

type CatalogResponse struct {
	Servers    []CatalogItem `json:"servers"`
	TotalCount int           `json:"totalCount"`
	Page       int           `json:"page"`
	PageSize   int           `json:"pageSize"`
	TotalPages int           `json:"totalPages"`
}

// smitheryResponse mirrors the Smithery API JSON shape.
type smitheryResponse struct {
	Servers    []smitheryServer   `json:"servers"`
	Pagination smitheryPagination `json:"pagination"`
}

type smitheryServer struct {
	ID            string  `json:"id"`
	QualifiedName string  `json:"qualifiedName"`
	DisplayName   string  `json:"displayName"`
	Description   string  `json:"description"`
	IconURL       string  `json:"iconUrl"`
	Verified      bool    `json:"verified"`
	UseCount      int     `json:"useCount"`
	Homepage      string  `json:"homepage"`
	CreatedAt     string  `json:"createdAt"`
	Score         float64 `json:"score"`
}

type smitheryPagination struct {
	CurrentPage int `json:"currentPage"`
	PageSize    int `json:"pageSize"`
	TotalPages  int `json:"totalPages"`
	TotalCount  int `json:"totalCount"`
}

type cacheEntry struct {
	resp      *CatalogResponse
	fetchedAt time.Time
}

// MCPCatalog provides browsing and install config for MCP servers via Smithery registry.
type MCPCatalog struct {
	client   *http.Client
	mu       sync.RWMutex
	cache    map[string]*cacheEntry
	cacheTTL time.Duration
}

func NewMCPCatalog() *MCPCatalog {
	return &MCPCatalog{
		client:   &http.Client{Timeout: 10 * time.Second},
		cache:    make(map[string]*cacheEntry),
		cacheTTL: 5 * time.Minute,
	}
}

const (
	smitheryBaseURL = "https://registry.smithery.ai/servers"
	defaultPageSize = 30
)

// Search queries the Smithery registry and enriches results with local install configs.
func (c *MCPCatalog) Search(query string, page int) (*CatalogResponse, error) {
	if page < 1 {
		page = 1
	}

	cacheKey := fmt.Sprintf("%s:%d", query, page)

	c.mu.RLock()
	if entry, ok := c.cache[cacheKey]; ok && time.Since(entry.fetchedAt) < c.cacheTTL {
		c.mu.RUnlock()
		return entry.resp, nil
	}
	c.mu.RUnlock()

	params := url.Values{}
	if query != "" {
		params.Set("q", query)
	}
	params.Set("page", fmt.Sprintf("%d", page))
	params.Set("pageSize", fmt.Sprintf("%d", defaultPageSize))

	reqURL := smitheryBaseURL + "?" + params.Encode()
	resp, err := c.client.Get(reqURL)
	if err != nil {
		return nil, fmt.Errorf("smithery request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("smithery returned %d: %s", resp.StatusCode, string(body))
	}

	var sr smitheryResponse
	if err := json.NewDecoder(resp.Body).Decode(&sr); err != nil {
		return nil, fmt.Errorf("failed to decode smithery response: %w", err)
	}

	result := &CatalogResponse{
		Servers:    make([]CatalogItem, 0, len(sr.Servers)),
		TotalCount: sr.Pagination.TotalCount,
		Page:       sr.Pagination.CurrentPage,
		PageSize:   sr.Pagination.PageSize,
		TotalPages: sr.Pagination.TotalPages,
	}

	for _, s := range sr.Servers {
		item := CatalogItem{
			ID:            s.ID,
			QualifiedName: s.QualifiedName,
			DisplayName:   s.DisplayName,
			Description:   s.Description,
			IconURL:       s.IconURL,
			Verified:      s.Verified,
			UseCount:      s.UseCount,
			Homepage:      s.Homepage,
			CreatedAt:     s.CreatedAt,
		}
		if cfg, ok := knownInstallConfigs[s.QualifiedName]; ok {
			item.InstallConfig = &cfg
		}
		result.Servers = append(result.Servers, item)
	}

	c.mu.Lock()
	c.cache[cacheKey] = &cacheEntry{resp: result, fetchedAt: time.Now()}
	c.mu.Unlock()

	return result, nil
}

// GetInstallConfig returns install config for a server by qualified name.
// First tries exact match, then keyword-based fuzzy matching, then falls back to default.
func (c *MCPCatalog) GetInstallConfig(qualifiedName string) *InstallConfig {
	// Exact match
	if cfg, ok := knownInstallConfigs[qualifiedName]; ok {
		cp := cfg
		return &cp
	}

	// Fuzzy match: check if qualifiedName contains a known keyword
	lower := strings.ToLower(qualifiedName)
	for key, cfg := range knownInstallConfigs {
		keyLower := strings.ToLower(key)
		// Extract the service name from known keys like "@modelcontextprotocol/server-github" → "github"
		parts := strings.Split(keyLower, "/")
		serviceName := parts[len(parts)-1]
		serviceName = strings.TrimPrefix(serviceName, "server-")
		serviceName = strings.TrimPrefix(serviceName, "mcp-server-")
		serviceName = strings.TrimPrefix(serviceName, "mcp-")

		if serviceName != "" && strings.Contains(lower, serviceName) {
			cp := cfg
			// Override args with the actual qualifiedName for npx
			cp.Args = []string{"-y", qualifiedName}
			return &cp
		}
	}

	return &InstallConfig{
		Command: "npx",
		Args:    []string{"-y", qualifiedName},
		EnvVars: nil,
	}
}

// MCPJsonImportEntry represents a single server parsed from a .mcp.json paste.
type MCPJsonImportEntry struct {
	ServerKey string            `json:"serverKey"`
	Command   string            `json:"command"`
	Args      []string          `json:"args"`
	Env       map[string]string `json:"env"`
}

// ParseMCPJson parses a .mcp.json format string and returns server entries.
func (c *MCPCatalog) ParseMCPJson(jsonStr string) ([]MCPJsonImportEntry, error) {
	var mcpFile struct {
		MCPServers map[string]struct {
			Command string            `json:"command"`
			Args    []string          `json:"args"`
			Env     map[string]string `json:"env"`
		} `json:"mcpServers"`
	}

	if err := json.Unmarshal([]byte(jsonStr), &mcpFile); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}

	if len(mcpFile.MCPServers) == 0 {
		return nil, fmt.Errorf("no mcpServers found in JSON")
	}

	entries := make([]MCPJsonImportEntry, 0, len(mcpFile.MCPServers))
	for key, srv := range mcpFile.MCPServers {
		entries = append(entries, MCPJsonImportEntry{
			ServerKey: key,
			Command:   srv.Command,
			Args:      srv.Args,
			Env:       srv.Env,
		})
	}
	return entries, nil
}

// knownInstallConfigs holds curated install configurations for popular MCP servers.
var knownInstallConfigs = map[string]InstallConfig{
	"@modelcontextprotocol/server-github": {
		Command: "npx",
		Args:    []string{"-y", "@modelcontextprotocol/server-github"},
		DocURL:  "https://github.com/modelcontextprotocol/servers/tree/main/src/github",
		EnvVars: []EnvVarDef{
			{Name: "GITHUB_PERSONAL_ACCESS_TOKEN", Description: "GitHub Personal Access Token with repo scope", Required: true, Placeholder: "ghp_..."},
		},
	},
	"@modelcontextprotocol/server-gitlab": {
		Command: "npx",
		Args:    []string{"-y", "@modelcontextprotocol/server-gitlab"},
		DocURL:  "https://github.com/modelcontextprotocol/servers/tree/main/src/gitlab",
		EnvVars: []EnvVarDef{
			{Name: "GITLAB_PERSONAL_ACCESS_TOKEN", Description: "GitLab Personal Access Token", Required: true, Placeholder: "glpat-..."},
			{Name: "GITLAB_API_URL", Description: "GitLab API URL", Required: false, Placeholder: "https://gitlab.com/api/v4"},
		},
	},
	"@modelcontextprotocol/server-filesystem": {
		Command: "npx",
		Args:    []string{"-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"},
		DocURL:  "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem",
		EnvVars: nil,
	},
	"@modelcontextprotocol/server-postgres": {
		Command: "npx",
		Args:    []string{"-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"},
		DocURL:  "https://github.com/modelcontextprotocol/servers/tree/main/src/postgres",
		EnvVars: nil,
	},
	"@modelcontextprotocol/server-sqlite": {
		Command: "npx",
		Args:    []string{"-y", "@modelcontextprotocol/server-sqlite", "--db-path", "/path/to/database.db"},
		DocURL:  "https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite",
		EnvVars: nil,
	},
	"@modelcontextprotocol/server-brave-search": {
		Command: "npx",
		Args:    []string{"-y", "@modelcontextprotocol/server-brave-search"},
		DocURL:  "https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search",
		EnvVars: []EnvVarDef{
			{Name: "BRAVE_API_KEY", Description: "Brave Search API key", Required: true, Placeholder: "BSA..."},
		},
	},
	"@modelcontextprotocol/server-fetch": {
		Command: "npx",
		Args:    []string{"-y", "@modelcontextprotocol/server-fetch"},
		DocURL:  "https://github.com/modelcontextprotocol/servers/tree/main/src/fetch",
		EnvVars: nil,
	},
	"@modelcontextprotocol/server-memory": {
		Command: "npx",
		Args:    []string{"-y", "@modelcontextprotocol/server-memory"},
		DocURL:  "https://github.com/modelcontextprotocol/servers/tree/main/src/memory",
		EnvVars: nil,
	},
	"@modelcontextprotocol/server-sequential-thinking": {
		Command: "npx",
		Args:    []string{"-y", "@modelcontextprotocol/server-sequential-thinking"},
		DocURL:  "https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking",
		EnvVars: nil,
	},
	"@modelcontextprotocol/server-puppeteer": {
		Command: "npx",
		Args:    []string{"-y", "@modelcontextprotocol/server-puppeteer"},
		DocURL:  "https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer",
		EnvVars: nil,
	},
	"@modelcontextprotocol/server-git": {
		Command: "npx",
		Args:    []string{"-y", "@modelcontextprotocol/server-git"},
		DocURL:  "https://github.com/modelcontextprotocol/servers/tree/main/src/git",
		EnvVars: nil,
	},
	"@modelcontextprotocol/server-google-maps": {
		Command: "npx",
		Args:    []string{"-y", "@modelcontextprotocol/server-google-maps"},
		DocURL:  "https://github.com/modelcontextprotocol/servers/tree/main/src/google-maps",
		EnvVars: []EnvVarDef{
			{Name: "GOOGLE_MAPS_API_KEY", Description: "Google Maps API key", Required: true, Placeholder: "AIza..."},
		},
	},
	"@modelcontextprotocol/server-slack": {
		Command: "npx",
		Args:    []string{"-y", "@modelcontextprotocol/server-slack"},
		DocURL:  "https://github.com/modelcontextprotocol/servers/tree/main/src/slack",
		EnvVars: []EnvVarDef{
			{Name: "SLACK_BOT_TOKEN", Description: "Slack Bot OAuth token", Required: true, Placeholder: "xoxb-..."},
			{Name: "SLACK_TEAM_ID", Description: "Slack Team/Workspace ID", Required: false, Placeholder: "T0..."},
		},
	},
	"@anthropic-ai/claude-code": {
		Command: "npx",
		Args:    []string{"-y", "@anthropic-ai/claude-code", "--mcp"},
		DocURL:  "https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview",
		EnvVars: []EnvVarDef{
			{Name: "ANTHROPIC_API_KEY", Description: "Anthropic API key for Claude", Required: true, Placeholder: "sk-ant-..."},
		},
	},
	"@smithery/mcp-server-linear": {
		Command: "npx",
		Args:    []string{"-y", "@smithery/mcp-server-linear"},
		DocURL:  "https://smithery.ai/server/@smithery/mcp-server-linear",
		EnvVars: []EnvVarDef{
			{Name: "LINEAR_API_KEY", Description: "Linear API key", Required: true, Placeholder: "lin_api_..."},
		},
	},
	"@modelcontextprotocol/server-sentry": {
		Command: "npx",
		Args:    []string{"-y", "@modelcontextprotocol/server-sentry"},
		DocURL:  "https://github.com/modelcontextprotocol/servers/tree/main/src/sentry",
		EnvVars: []EnvVarDef{
			{Name: "SENTRY_AUTH_TOKEN", Description: "Sentry authentication token", Required: true},
			{Name: "SENTRY_ORG", Description: "Sentry organization slug", Required: false},
			{Name: "SENTRY_PROJECT", Description: "Sentry project slug", Required: false},
		},
	},
	"@modelcontextprotocol/server-notion": {
		Command: "npx",
		Args:    []string{"-y", "@modelcontextprotocol/server-notion"},
		DocURL:  "https://github.com/modelcontextprotocol/servers/tree/main/src/notion",
		EnvVars: []EnvVarDef{
			{Name: "NOTION_API_KEY", Description: "Notion integration token", Required: true, Placeholder: "ntn_..."},
		},
	},
	"@modelcontextprotocol/server-google-drive": {
		Command: "npx",
		Args:    []string{"-y", "@modelcontextprotocol/server-google-drive"},
		DocURL:  "https://github.com/modelcontextprotocol/servers/tree/main/src/gdrive",
		EnvVars: []EnvVarDef{
			{Name: "GOOGLE_CLIENT_ID", Description: "Google OAuth client ID", Required: true},
			{Name: "GOOGLE_CLIENT_SECRET", Description: "Google OAuth client secret", Required: true},
		},
	},
	"docker-mcp": {
		Command: "npx",
		Args:    []string{"-y", "docker-mcp"},
		DocURL:  "https://github.com/docker/docker-mcp",
		EnvVars: nil,
	},
	"kubernetes-mcp-server": {
		Command: "npx",
		Args:    []string{"-y", "kubernetes-mcp-server"},
		DocURL:  "https://github.com/strowk/mcp-k8s-go",
		EnvVars: nil,
	},
	"@modelcontextprotocol/server-redis": {
		Command: "npx",
		Args:    []string{"-y", "@modelcontextprotocol/server-redis", "redis://localhost:6379"},
		DocURL:  "https://github.com/modelcontextprotocol/servers/tree/main/src/redis",
		EnvVars: nil,
	},
	"@punkpeye/mcp-atlassian": {
		Command: "npx",
		Args:    []string{"-y", "@punkpeye/mcp-atlassian"},
		DocURL:  "https://github.com/punkpeye/mcp-atlassian",
		EnvVars: []EnvVarDef{
			{Name: "ATLASSIAN_EMAIL", Description: "Atlassian account email", Required: true},
			{Name: "ATLASSIAN_API_TOKEN", Description: "Atlassian API token", Required: true},
			{Name: "ATLASSIAN_URL", Description: "Atlassian instance URL", Required: true, Placeholder: "https://yoursite.atlassian.net"},
		},
	},
	"@modelcontextprotocol/server-aws-kb-retrieval": {
		Command: "npx",
		Args:    []string{"-y", "@modelcontextprotocol/server-aws-kb-retrieval"},
		DocURL:  "https://github.com/modelcontextprotocol/servers/tree/main/src/aws-kb-retrieval-server",
		EnvVars: []EnvVarDef{
			{Name: "AWS_ACCESS_KEY_ID", Description: "AWS access key", Required: true},
			{Name: "AWS_SECRET_ACCESS_KEY", Description: "AWS secret key", Required: true},
			{Name: "AWS_REGION", Description: "AWS region", Required: false, Placeholder: "us-east-1"},
		},
	},
	"@modelcontextprotocol/server-grafana": {
		Command: "npx",
		Args:    []string{"-y", "@modelcontextprotocol/server-grafana"},
		DocURL:  "https://github.com/modelcontextprotocol/servers/tree/main/src/grafana",
		EnvVars: []EnvVarDef{
			{Name: "GRAFANA_URL", Description: "Grafana instance URL", Required: true, Placeholder: "http://localhost:3000"},
			{Name: "GRAFANA_API_KEY", Description: "Grafana API key", Required: true},
		},
	},
}
