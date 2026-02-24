package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type Config struct {
	ClaudeCLIPath string `json:"claude_cli_path"`
	WorkspacePath string `json:"workspace_path"`
	DataDir       string `json:"data_dir"`
	LogLevel      string `json:"log_level"`
	Theme         string `json:"theme"`
	Language      string `json:"language"`
}

func DefaultConfig() *Config {
	home, _ := os.UserHomeDir()
	return &Config{
		ClaudeCLIPath: "claude",
		WorkspacePath: filepath.Join(home, ".agent-workflow", "workspaces"),
		DataDir:       filepath.Join(home, ".agent-workflow"),
		LogLevel:      "info",
		Theme:         "dark",
		Language:      "en",
	}
}

func Load() (*Config, error) {
	cfg := DefaultConfig()
	configPath := filepath.Join(cfg.DataDir, "config.json")

	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			return cfg, cfg.Save()
		}
		return nil, err
	}

	if err := json.Unmarshal(data, cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}

func (c *Config) Save() error {
	if err := os.MkdirAll(c.DataDir, 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	configPath := filepath.Join(c.DataDir, "config.json")
	return os.WriteFile(configPath, data, 0644)
}
