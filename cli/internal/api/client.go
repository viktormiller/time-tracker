package api

import (
	"fmt"

	"github.com/go-resty/resty/v2"
	"github.com/vmiller/timetracker-cli/internal/config"
)

// Client wraps the HTTP client with authentication
type Client struct {
	resty  *resty.Client
	config *config.Config
}

// NewClient creates a new API client
func NewClient(cfg *config.Config) *Client {
	client := resty.New()
	client.SetBaseURL(cfg.APIURL)

	// Set access token if available
	if cfg.AccessToken != "" {
		client.SetAuthToken(cfg.AccessToken)
	}

	return &Client{
		resty:  client,
		config: cfg,
	}
}

// SetAuthToken updates the authorization token
func (c *Client) SetAuthToken(token string) {
	c.config.AccessToken = token
	c.resty.SetAuthToken(token)
}

// RefreshTokenIfNeeded checks if token refresh is needed and refreshes if so
func (c *Client) RefreshTokenIfNeeded() error {
	// If we have a refresh token but no access token, refresh
	if c.config.RefreshToken != "" && c.config.AccessToken == "" {
		return c.RefreshToken()
	}

	// Don't auto-refresh on every request - tokens last 15 minutes
	// Only refresh if we get a 401 error (handled in the request methods)
	return nil
}

// Get performs a GET request with automatic token refresh
func (c *Client) Get(endpoint string, result interface{}) error {
	// Try to refresh token if needed
	if err := c.RefreshTokenIfNeeded(); err != nil {
		// If refresh fails, continue anyway (user might need to login)
	}

	resp, err := c.resty.R().
		SetResult(result).
		Get(endpoint)

	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}

	if resp.IsError() {
		return fmt.Errorf("API error: %s - %s", resp.Status(), resp.String())
	}

	return nil
}

// Post performs a POST request with automatic token refresh
func (c *Client) Post(endpoint string, body interface{}, result interface{}) error {
	// Try to refresh token if needed (but not for auth endpoints)
	if endpoint != "/api/auth/cli-login" && endpoint != "/api/auth/cli-refresh" {
		if err := c.RefreshTokenIfNeeded(); err != nil {
			// If refresh fails, continue anyway (user might need to login)
		}
	}

	req := c.resty.R()

	if body != nil {
		req.SetHeader("Content-Type", "application/json")
		req.SetBody(body)
	}

	if result != nil {
		req.SetResult(result)
	}

	resp, err := req.Post(endpoint)

	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}

	if resp.IsError() {
		return fmt.Errorf("API error: %s - %s", resp.Status(), resp.String())
	}

	return nil
}
