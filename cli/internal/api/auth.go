package api

import (
	"fmt"

	"github.com/vmiller/timetracker-cli/internal/config"
)

// LoginRequest represents the login request body
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// LoginResponse represents the login response
type LoginResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresIn    int    `json:"expiresIn"`
}

// RefreshRequest represents the refresh token request body
type RefreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

// RefreshResponse represents the refresh token response
type RefreshResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresIn    int    `json:"expiresIn"`
}

// Login authenticates the user and stores tokens
func (c *Client) Login(username, password string) error {
	req := LoginRequest{
		Username: username,
		Password: password,
	}

	var resp LoginResponse
	if err := c.Post("/api/auth/cli-login", req, &resp); err != nil {
		return fmt.Errorf("login failed: %w", err)
	}

	// Update config with new tokens
	c.config.AccessToken = resp.AccessToken
	c.config.RefreshToken = resp.RefreshToken

	// Update client auth token
	c.SetAuthToken(resp.AccessToken)

	// Save config
	if err := config.Save(c.config); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}

	return nil
}

// RefreshToken refreshes the access token using the refresh token
func (c *Client) RefreshToken() error {
	if c.config.RefreshToken == "" {
		return fmt.Errorf("no refresh token available")
	}

	req := RefreshRequest{
		RefreshToken: c.config.RefreshToken,
	}

	var resp RefreshResponse
	if err := c.Post("/api/auth/cli-refresh", req, &resp); err != nil {
		return fmt.Errorf("token refresh failed: %w", err)
	}

	// Update config with new tokens
	c.config.AccessToken = resp.AccessToken
	c.config.RefreshToken = resp.RefreshToken

	// Update client auth token
	c.SetAuthToken(resp.AccessToken)

	// Save config
	if err := config.Save(c.config); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}

	return nil
}
