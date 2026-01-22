package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/vmiller/timetracker-cli/internal/api"
	"github.com/vmiller/timetracker-cli/internal/config"
	"github.com/vmiller/timetracker-cli/internal/display"
)

// weekCmd represents the week command
var weekCmd = &cobra.Command{
	Use:   "week",
	Short: "Show this week's time tracking summary",
	Long: `Display a summary of this week's logged hours including:
  - Daily breakdown (Monday-Sunday)
  - Total hours for the week
  - Breakdown by source (Toggl, Tempo, Manual)`,
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

		// Fetch week's summary
		var summary api.WeekSummaryResponse
		if err := client.Get("/api/entries/summary/week", &summary); err != nil {
			return fmt.Errorf("failed to fetch week's summary: %w", err)
		}

		// Display results
		fmt.Printf("\n📆 Week: %s to %s\n\n", summary.WeekStart, summary.WeekEnd)

		// Create table for daily breakdown
		table := display.NewTable("Day", "Date", "Hours")
		for _, day := range summary.Daily {
			hoursStr := fmt.Sprintf("%.2f", day.Hours)
			table.AddRow(day.DayName, day.Date, hoursStr)
		}
		table.Print()

		fmt.Printf("\n⏱️  Total Hours: %.2f\n", summary.TotalHours)
		fmt.Printf("📊 Total Entries: %d\n\n", summary.EntryCount)

		if len(summary.BySource) > 0 {
			fmt.Println("Breakdown by Source:")
			for source, hours := range summary.BySource {
				fmt.Printf("  • %-8s %.2fh\n", source+":", hours)
			}
		}

		fmt.Println()

		return nil
	},
}

func init() {
	rootCmd.AddCommand(weekCmd)
}
