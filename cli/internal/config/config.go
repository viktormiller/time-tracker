package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

// Config holds the application configuration
type Config struct {
	APIURL       string `mapstructure:"api_url"`
	AccessToken  string `mapstructure:"access_token"`
	RefreshToken string `mapstructure:"refresh_token"`
}

// Load reads the configuration from the config file
func Load() (*Config, error) {
	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	// Set default API URL if not configured
	if cfg.APIURL == "" {
		cfg.APIURL = viper.GetString("api_url")
		if cfg.APIURL == "" {
			cfg.APIURL = "http://localhost:3000"
		}
	}

	return &cfg, nil
}

// Save writes the configuration to the config file
func Save(cfg *Config) error {
	// Set values in viper
	viper.Set("api_url", cfg.APIURL)
	viper.Set("access_token", cfg.AccessToken)
	viper.Set("refresh_token", cfg.RefreshToken)

	// Get config file path
	configFile := viper.ConfigFileUsed()
	if configFile == "" {
		// Create default config file path
		home, err := os.UserHomeDir()
		if err != nil {
			return fmt.Errorf("failed to get home directory: %w", err)
		}

		configDir := filepath.Join(home, ".timetracker")
		configFile = filepath.Join(configDir, "config.yaml")

		// Create directory with secure permissions (0700 = drwx------)
		if err := os.MkdirAll(configDir, 0700); err != nil {
			return fmt.Errorf("failed to create config directory: %w", err)
		}
	}

	// Write config file with secure permissions (0600 = -rw-------)
	if err := viper.WriteConfigAs(configFile); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	// Ensure file has correct permissions (in case it already existed)
	if err := os.Chmod(configFile, 0600); err != nil {
		return fmt.Errorf("failed to set config file permissions: %w", err)
	}

	return nil
}

// Clear removes authentication tokens from the config
func Clear() error {
	viper.Set("access_token", "")
	viper.Set("refresh_token", "")

	configFile := viper.ConfigFileUsed()
	if configFile == "" {
		return nil // No config file to clear
	}

	return viper.WriteConfig()
}
