package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/vmiller/timetracker-cli/internal/api"
	"github.com/vmiller/timetracker-cli/internal/config"
)

// todayCmd represents the today command
var todayCmd = &cobra.Command{
	Use:   "today",
	Short: "Show today's time tracking summary",
	Long: `Display a summary of today's logged hours including:
  - Total hours worked today
  - Breakdown by source (Toggl, Tempo, Manual)
  - Number of entries`,
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

		// Fetch today's summary
		var summary api.TodaySummaryResponse
		if err := client.Get("/api/entries/summary/today", &summary); err != nil {
			return fmt.Errorf("failed to fetch today's summary: %w", err)
		}

		// Display results
		fmt.Printf("\n📅 %s\n\n", summary.Date)
		fmt.Printf("⏱️  Total Hours: %.2f\n", summary.TotalHours)
		fmt.Printf("📊 Entries: %d\n\n", summary.EntryCount)

		if len(summary.BySource) > 0 {
			fmt.Println("Breakdown by Source:")
			for source, hours := range summary.BySource {
				fmt.Printf("  • %-8s %.2fh\n", source+":", hours)
			}
		} else {
			fmt.Println("No time entries logged today.")
		}

		fmt.Println()

		return nil
	},
}

func init() {
	rootCmd.AddCommand(todayCmd)
}
