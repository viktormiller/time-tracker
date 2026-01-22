package api

// TodaySummaryResponse represents the response from /api/entries/summary/today
type TodaySummaryResponse struct {
	Date       string             `json:"date"`
	TotalHours float64            `json:"totalHours"`
	BySource   map[string]float64 `json:"bySource"`
	EntryCount int                `json:"entryCount"`
}

// WeekSummaryResponse represents the response from /api/entries/summary/week
type WeekSummaryResponse struct {
	WeekStart  string             `json:"weekStart"`
	WeekEnd    string             `json:"weekEnd"`
	TotalHours float64            `json:"totalHours"`
	Daily      []DailySummary     `json:"daily"`
	BySource   map[string]float64 `json:"bySource"`
	EntryCount int                `json:"entryCount"`
}

// DailySummary represents a single day's summary
type DailySummary struct {
	Date    string  `json:"date"`
	DayName string  `json:"dayName"`
	Hours   float64 `json:"hours"`
}

// SyncResponse represents the response from /api/sync
type SyncResponse struct {
	Success       bool         `json:"success"`
	TotalImported int          `json:"totalImported"`
	TotalSkipped  int          `json:"totalSkipped"`
	Results       []SyncResult `json:"results"`
}

// SyncResult represents the result for a single provider
type SyncResult struct {
	Provider string `json:"provider"`
	Success  bool   `json:"success"`
	Imported int    `json:"imported,omitempty"`
	Skipped  int    `json:"skipped,omitempty"`
	Error    string `json:"error,omitempty"`
}
