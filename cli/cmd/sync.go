package cmd

import (
	"fmt"
	"time"

	"github.com/spf13/cobra"
	"github.com/vmiller/timetracker-cli/internal/api"
	"github.com/vmiller/timetracker-cli/internal/config"
)

var forceSync bool

// syncCmd represents the sync command
var syncCmd = &cobra.Command{
	Use:   "sync",
	Short: "Sync time entries from all providers",
	Long: `Trigger a sync operation to fetch time entries from all configured providers:
  - Toggl (if configured)
  - Tempo (if configured)

Use --force to force a full refresh instead of incremental sync.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		// Load config
		cfg, err := config.Load()
		if err != nil {
			return fmt.Errorf("failed to load config: %w", err)
		}

		// Check if logged in
		if cfg.AccessToken == "" && cfg.RefreshToken == "" {
			return fmt.Errorf("not logged in. Run 'timetracker login' first")
		}

		// Create API client
		client := api.NewClient(cfg)

		// Show spinner (simple text-based animation)
		done := make(chan bool)
		go func() {
			spinner := []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}
			i := 0
			for {
				select {
				case <-done:
					return
				default:
					fmt.Printf("\r%s Syncing from providers...", spinner[i%len(spinner)])
					i++
					time.Sleep(100 * time.Millisecond)
				}
			}
		}()

		// Trigger sync
		endpoint := "/api/sync"
		if forceSync {
			endpoint += "?force=true"
		}

		var syncResp api.SyncResponse
		err = client.Post(endpoint, nil, &syncResp)

		// Stop spinner
		done <- true
		fmt.Print("\r") // Clear spinner line

		if err != nil {
			return fmt.Errorf("sync failed: %w", err)
		}

		// Display results
		if syncResp.Success {
			fmt.Println("✓ Sync completed successfully!\n")
		} else {
			fmt.Println("⚠️  Sync completed with errors\n")
		}

		fmt.Printf("📥 Imported: %d entries\n", syncResp.TotalImported)
		fmt.Printf("⏭️  Skipped: %d entries\n\n", syncResp.TotalSkipped)

		// Show per-provider results
		fmt.Println("Provider Results:")
		for _, result := range syncResp.Results {
			if result.Success {
				fmt.Printf("  ✓ %-8s imported: %d, skipped: %d\n",
					result.Provider+":",
					result.Imported,
					result.Skipped)
			} else {
				fmt.Printf("  ✗ %-8s %s\n",
					result.Provider+":",
					result.Error)
			}
		}

		fmt.Println()

		return nil
	},
}

func init() {
	rootCmd.AddCommand(syncCmd)

	// Add force flag
	syncCmd.Flags().BoolVarP(&forceSync, "force", "f", false, "Force a full refresh (ignores last sync time)")
}
