package cmd

import (
	"fmt"
	"os"
	"syscall"

	"github.com/spf13/cobra"
	"github.com/vmiller/timetracker-cli/internal/api"
	"github.com/vmiller/timetracker-cli/internal/config"
	"golang.org/x/term"
)

var (
	username string
	password string
)

// loginCmd represents the login command
var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Authenticate with the TimeTracker API",
	Long: `Authenticate with the TimeTracker API and store credentials securely.

The credentials are stored in ~/.timetracker/config.yaml with 0600 permissions
(readable only by the current user).

You can provide credentials via flags or be prompted interactively.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		// Load config
		cfg, err := config.Load()
		if err != nil {
			return fmt.Errorf("failed to load config: %w", err)
		}

		// Prompt for username if not provided
		if username == "" {
			fmt.Print("Username: ")
			fmt.Scanln(&username)
		}

		// Prompt for password if not provided (with masking)
		if password == "" {
			fmt.Print("Password: ")
			bytepw, err := term.ReadPassword(int(syscall.Stdin))
			if err != nil {
				return fmt.Errorf("failed to read password: %w", err)
			}
			password = string(bytepw)
			fmt.Println() // Add newline after password input
		}

		// Validate inputs
		if username == "" || password == "" {
			return fmt.Errorf("username and password are required")
		}

		// Create API client
		client := api.NewClient(cfg)

		// Attempt login
		fmt.Printf("Logging in as %s...\n", username)
		if err := client.Login(username, password); err != nil {
			return fmt.Errorf("login failed: %w", err)
		}

		fmt.Println("✓ Login successful!")
		fmt.Printf("Config saved to: %s/.timetracker/config.yaml\n", os.Getenv("HOME"))

		return nil
	},
}

func init() {
	rootCmd.AddCommand(loginCmd)

	// Flags for non-interactive login
	loginCmd.Flags().StringVarP(&username, "username", "u", "", "Username for authentication")
	loginCmd.Flags().StringVarP(&password, "password", "p", "", "Password for authentication (not recommended, use interactive prompt)")
}
