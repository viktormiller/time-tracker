# Phase 6: CLI Tool - Research

**Researched:** 2026-01-22
**Domain:** Go CLI development, REST API integration
**Confidence:** HIGH

## Summary

This phase implements a Go-based command-line interface for the time-tracker application, enabling terminal-based access to time tracking data without requiring a browser. The CLI will authenticate with the existing Fastify backend using JWT tokens and provide commands for viewing today's hours, weekly summaries, and triggering sync operations.

The Go ecosystem has mature, well-established libraries for CLI development. Cobra is the de-facto standard for CLI frameworks (used by Kubernetes, Hugo, GitHub CLI), Viper handles configuration management, and Resty provides a robust HTTP client with middleware support for authentication. The existing backend already has the necessary authentication infrastructure; the CLI needs new summary endpoints and a token management strategy suitable for non-browser clients.

**Primary recommendation:** Use Cobra + Viper + Resty stack with secure local token storage in `~/.timetracker/`. Store refresh tokens (not access tokens) in the config file, and refresh automatically before each request.

## Standard Stack

The established libraries/tools for Go CLI development:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| [spf13/cobra](https://github.com/spf13/cobra) | v1.8+ | CLI framework | Used by Kubernetes, Hugo, GitHub CLI; 173k+ projects |
| [spf13/viper](https://github.com/spf13/viper) | v1.18+ | Configuration management | Seamless Cobra integration, YAML/env/flag support |
| [go-resty/resty/v2](https://github.com/go-resty/resty) | v2.14+ | HTTP client | Middleware support, automatic retries, JSON handling |
| [olekukonko/tablewriter](https://github.com/olekukonko/tablewriter) | v1.1.3 | ASCII table output | Most popular Go table library, multiple formats |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| [briandowns/spinner](https://github.com/briandowns/spinner) | v1.23+ | Progress indicators | During sync operations |
| [fatih/color](https://github.com/fatih/color) | v1.16+ | Colored terminal output | Highlighting success/error states |
| golang.org/x/term | latest | Terminal detection | Check if stdout is a TTY for formatting |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Resty | net/http | Resty provides middleware, retries out of box; net/http requires manual implementation |
| tablewriter | jedib0t/go-pretty | go-pretty has more features but tablewriter is simpler and sufficient |
| Viper | koanf | koanf is lighter but Viper has better Cobra integration |
| zalando/go-keyring | File-based config | Keyring is more secure but adds OS dependencies; file config is simpler for initial MVP |

**Installation:**
```bash
# Initialize module
go mod init github.com/username/timetracker-cli

# Install dependencies
go get github.com/spf13/cobra@latest
go get github.com/spf13/viper@latest
go get github.com/go-resty/resty/v2@latest
go get github.com/olekukonko/tablewriter@latest
go get github.com/briandowns/spinner@latest
go get github.com/fatih/color@latest
```

## Architecture Patterns

### Recommended Project Structure
```
cli/
├── main.go                  # Entry point, calls cmd.Execute()
├── go.mod
├── go.sum
├── cmd/
│   ├── root.go              # Root command, Viper init
│   ├── today.go             # `timetracker today` command
│   ├── week.go              # `timetracker week` command
│   ├── sync.go              # `timetracker sync` command
│   └── login.go             # `timetracker login` command
├── internal/
│   ├── api/
│   │   ├── client.go        # Resty client with auth middleware
│   │   ├── auth.go          # Token refresh logic
│   │   └── types.go         # Response structs
│   ├── config/
│   │   └── config.go        # Config file management
│   └── display/
│       └── table.go         # Table formatting utilities
└── Makefile                 # Build, install, test targets
```

### Pattern 1: Cobra Command Structure
**What:** Each command is a separate file with a `*cobra.Command` variable
**When to use:** All subcommands
**Example:**
```go
// Source: https://cobra.dev/ - Official Cobra documentation
// cmd/today.go
package cmd

import (
    "github.com/spf13/cobra"
)

var todayCmd = &cobra.Command{
    Use:   "today",
    Short: "Show today's worked hours",
    Long:  `Display total hours worked today with breakdown by source (Toggl, Tempo, Manual).`,
    RunE: func(cmd *cobra.Command, args []string) error {
        // RunE returns error for proper exit codes
        return runToday()
    },
}

func init() {
    rootCmd.AddCommand(todayCmd)
}
```

### Pattern 2: Viper Configuration with Cobra
**What:** Viper manages config file, env vars, and flags with automatic binding
**When to use:** Root command initialization
**Example:**
```go
// Source: https://github.com/spf13/viper - Official Viper documentation
// cmd/root.go
package cmd

import (
    "os"
    "path/filepath"

    "github.com/spf13/cobra"
    "github.com/spf13/viper"
)

var cfgFile string

var rootCmd = &cobra.Command{
    Use:   "timetracker",
    Short: "CLI for time tracking",
}

func Execute() {
    if err := rootCmd.Execute(); err != nil {
        os.Exit(1)
    }
}

func init() {
    cobra.OnInitialize(initConfig)
    rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "",
        "config file (default is $HOME/.timetracker/config.yaml)")
}

func initConfig() {
    if cfgFile != "" {
        viper.SetConfigFile(cfgFile)
    } else {
        home, _ := os.UserHomeDir()
        configDir := filepath.Join(home, ".timetracker")
        os.MkdirAll(configDir, 0700) // Secure permissions

        viper.AddConfigPath(configDir)
        viper.SetConfigName("config")
        viper.SetConfigType("yaml")
    }

    viper.AutomaticEnv()
    viper.SetEnvPrefix("TIMETRACKER")
    viper.ReadInConfig() // Ignore error if file doesn't exist
}
```

### Pattern 3: Resty Client with Auth Middleware
**What:** Resty OnBeforeRequest hook handles token refresh automatically
**When to use:** All API requests
**Example:**
```go
// Source: https://github.com/go-resty/resty - Official Resty documentation
// internal/api/client.go
package api

import (
    "github.com/go-resty/resty/v2"
    "github.com/spf13/viper"
)

func NewClient() *resty.Client {
    client := resty.New().
        SetBaseURL(viper.GetString("api_url")).
        SetHeader("Content-Type", "application/json").
        OnBeforeRequest(func(c *resty.Client, r *resty.Request) error {
            // Check if token needs refresh
            token := viper.GetString("access_token")
            if token == "" || isTokenExpired() {
                if err := refreshToken(c); err != nil {
                    return err
                }
                token = viper.GetString("access_token")
            }
            r.SetAuthToken(token)
            return nil
        })

    return client
}
```

### Pattern 4: Table Output with tablewriter
**What:** Consistent ASCII table formatting for all data output
**When to use:** week command, any list output
**Example:**
```go
// Source: https://github.com/olekukonko/tablewriter - Official tablewriter
// internal/display/table.go
package display

import (
    "os"

    "github.com/olekukonko/tablewriter"
)

func RenderWeeklyTable(data [][]string) {
    table := tablewriter.NewWriter(os.Stdout)
    table.SetHeader([]string{"Day", "Hours", "Source"})
    table.SetBorder(true)
    table.SetRowLine(true)
    table.AppendBulk(data)
    table.Render()
}
```

### Anti-Patterns to Avoid
- **Storing plaintext passwords:** Never store passwords in config; store tokens only
- **Hardcoded API URLs:** Always use config/env vars for server URL
- **Ignoring exit codes:** Use `RunE` not `Run`, return errors properly
- **Blocking on long operations:** Show spinner during sync, don't freeze terminal
- **Assuming TTY:** Check `term.IsTerminal()` before using colors/spinners

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI argument parsing | Manual flag parsing | Cobra | Subcommands, help generation, completion |
| Config file handling | Custom YAML parser | Viper | Env binding, flag binding, multi-format |
| HTTP requests | net/http directly | Resty | Middleware, retries, JSON marshaling |
| Table formatting | fmt.Printf alignment | tablewriter | Column auto-sizing, borders, alignment |
| Progress indicators | Custom print loops | spinner | Thread-safe, 90+ styles, pipe-safe |
| Token refresh | Manual timing checks | Resty middleware | Centralized, automatic |

**Key insight:** Go CLI tooling is mature and battle-tested. Cobra+Viper is used by Kubernetes - if it handles kubectl's complexity, it handles this. Don't reinvent.

## Common Pitfalls

### Pitfall 1: CLI Token Management vs Web Token Management
**What goes wrong:** The backend uses HttpOnly cookies for refresh tokens, which don't work for CLI clients
**Why it happens:** Web security patterns (HttpOnly, SameSite) are designed for browsers
**How to avoid:**
- CLI needs its own token flow: login returns both access AND refresh token in response body
- Store refresh token in config file with 0600 permissions
- Either modify backend to support CLI flow, or create new `/api/auth/cli-login` endpoint
**Warning signs:** 401 errors when trying to use `/api/auth/refresh` from CLI

### Pitfall 2: Token Expiry During Long Sync Operations
**What goes wrong:** Access token expires mid-sync (tokens are 15-minute)
**Why it happens:** Sync can take 60+ seconds, token refresh doesn't happen mid-request
**How to avoid:**
- Check token expiry BEFORE starting sync
- Consider extending access token lifetime for CLI clients
- Or implement progress via SSE with token refresh between events
**Warning signs:** Sync starts successfully but fails partway through

### Pitfall 3: Config File Permissions
**What goes wrong:** Tokens stored with world-readable permissions (0644)
**Why it happens:** Default file creation uses umask
**How to avoid:**
- Explicitly set `os.MkdirAll(dir, 0700)` and `os.WriteFile(path, data, 0600)`
- Check permissions on config read and warn if too open
**Warning signs:** Other users on system can read tokens

### Pitfall 4: Missing API Endpoints
**What goes wrong:** CLI assumes endpoints exist that don't
**Why it happens:** Requirements specify endpoints that need to be created
**How to avoid:**
- Backend needs new endpoints:
  - `GET /api/entries/summary/today` (doesn't exist)
  - `GET /api/entries/summary/week` (doesn't exist)
  - `POST /api/sync` (partial - individual Toggl/Tempo exist, unified doesn't)
- Plan backend work FIRST, CLI work SECOND
**Warning signs:** 404 errors from CLI

### Pitfall 5: Spinner + Progress Output Conflicts
**What goes wrong:** Spinner and progress messages overlap/corrupt each other
**Why it happens:** Multiple goroutines writing to stdout
**How to avoid:**
- Use spinner's built-in suffix/prefix for status updates
- Or stop spinner before writing progress, restart after
- Use spinner's `FinalMSG` for completion message
**Warning signs:** Garbled terminal output during sync

## Code Examples

Verified patterns from official sources:

### Login Flow
```go
// internal/api/auth.go
package api

import (
    "fmt"
    "os"
    "path/filepath"

    "github.com/go-resty/resty/v2"
    "github.com/spf13/viper"
    "gopkg.in/yaml.v3"
)

type LoginResponse struct {
    AccessToken  string `json:"accessToken"`
    RefreshToken string `json:"refreshToken"` // CLI-specific: included in body
    ExpiresIn    int    `json:"expiresIn"`
}

func Login(username, password string) error {
    client := resty.New().SetBaseURL(viper.GetString("api_url"))

    var result LoginResponse
    resp, err := client.R().
        SetBody(map[string]string{
            "username": username,
            "password": password,
        }).
        SetResult(&result).
        Post("/api/auth/login")

    if err != nil {
        return fmt.Errorf("connection failed: %w", err)
    }

    if resp.StatusCode() != 200 {
        return fmt.Errorf("login failed: %s", resp.String())
    }

    // Save tokens to config
    viper.Set("access_token", result.AccessToken)
    viper.Set("refresh_token", result.RefreshToken)

    return saveConfig()
}

func saveConfig() error {
    home, _ := os.UserHomeDir()
    configPath := filepath.Join(home, ".timetracker", "config.yaml")

    // Extract settings to save
    config := map[string]interface{}{
        "api_url":       viper.GetString("api_url"),
        "access_token":  viper.GetString("access_token"),
        "refresh_token": viper.GetString("refresh_token"),
    }

    data, err := yaml.Marshal(config)
    if err != nil {
        return err
    }

    return os.WriteFile(configPath, data, 0600) // Secure permissions!
}
```

### Today Command
```go
// cmd/today.go
package cmd

import (
    "fmt"
    "os"

    "github.com/fatih/color"
    "github.com/spf13/cobra"
    "timetracker-cli/internal/api"
)

var todayCmd = &cobra.Command{
    Use:   "today",
    Short: "Show today's worked hours",
    RunE: func(cmd *cobra.Command, args []string) error {
        client := api.NewClient()

        var summary api.TodaySummary
        resp, err := client.R().
            SetResult(&summary).
            Get("/api/entries/summary/today")

        if err != nil {
            return fmt.Errorf("failed to fetch data: %w", err)
        }

        if resp.StatusCode() == 401 {
            fmt.Fprintln(os.Stderr, "Not authenticated. Run: timetracker login")
            return fmt.Errorf("authentication required")
        }

        if resp.StatusCode() != 200 {
            return fmt.Errorf("API error: %s", resp.String())
        }

        // Display output
        fmt.Printf("Today: %s\n\n", summary.Date)

        green := color.New(color.FgGreen, color.Bold)
        green.Printf("Total: %.1f hours\n\n", summary.TotalHours)

        fmt.Println("By Source:")
        for _, source := range summary.BySource {
            fmt.Printf("  %-10s %.1f hours\n", source.Name+":", source.Hours)
        }

        return nil
    },
}
```

### Sync with Spinner
```go
// cmd/sync.go
package cmd

import (
    "fmt"
    "time"

    "github.com/briandowns/spinner"
    "github.com/fatih/color"
    "github.com/spf13/cobra"
    "timetracker-cli/internal/api"
)

var syncCmd = &cobra.Command{
    Use:   "sync",
    Short: "Sync time entries from all sources",
    RunE: func(cmd *cobra.Command, args []string) error {
        client := api.NewClient()

        // Start spinner
        s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)
        s.Suffix = " Syncing time entries..."
        s.Start()

        var result api.SyncResult
        resp, err := client.R().
            SetResult(&result).
            SetTimeout(60*time.Second).
            Post("/api/sync")

        s.Stop()

        if err != nil {
            return fmt.Errorf("sync failed: %w", err)
        }

        if resp.StatusCode() != 200 {
            return fmt.Errorf("sync error: %s", resp.String())
        }

        // Display results
        green := color.New(color.FgGreen)
        green.Println("Sync complete!")
        fmt.Printf("  New entries: %d\n", result.NewEntries)
        fmt.Printf("  Updated: %d\n", result.Updated)
        fmt.Printf("  Errors: %d\n", result.Errors)

        return nil
    },
}
```

## Backend API Requirements

The following endpoints need to be created/modified for CLI support:

### New Endpoints Required
| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/api/entries/summary/today` | GET | Today's hours summary | `{date, totalHours, bySource: [{name, hours}]}` |
| `/api/entries/summary/week` | GET | Weekly summary | `{startDate, endDate, totalHours, byDay: [{date, hours}], bySource: [{name, hours}]}` |
| `/api/sync` | POST | Unified sync all providers | `{newEntries, updated, errors, details: [...]}` |

### Auth Modification for CLI
The current auth flow uses HttpOnly cookies which won't work for CLI. Options:
1. **Option A (Recommended):** Add CLI-specific login endpoint that returns refresh token in body
2. **Option B:** Modify existing login to detect CLI client (via User-Agent) and include refresh token
3. **Option C:** Use long-lived API tokens instead of JWT (simpler but less secure)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| GOPATH workspace | Go modules | Go 1.16+ (2021) | Always use `go mod init` |
| flag package | Cobra/pflag | ~2015 | Cobra standard for any multi-command CLI |
| encoding/json + net/http | Resty | ~2018 | Resty handles common patterns |
| tablewriter v0.x | tablewriter v1.x | 2024 | New API with renderers, generics support |

**Deprecated/outdated:**
- `dgrijalva/jwt-go`: Use `golang-jwt/jwt/v5` instead (security fixes)
- `dep` for dependencies: Use Go modules (`go mod`)
- `GOPATH` required: No longer needed with modules

## Open Questions

Things that couldn't be fully resolved:

1. **CLI Auth Token Strategy**
   - What we know: Backend uses HttpOnly cookies, won't work for CLI
   - What's unclear: Should we modify existing endpoint or create new one?
   - Recommendation: Create `/api/auth/cli-login` that returns refresh token in body; keeps web security intact

2. **Sync Progress Updates**
   - What we know: Requirements mention "progress indicator during sync"
   - What's unclear: Whether backend sync is synchronous (spinner) or should use SSE
   - Recommendation: Start with simple spinner + final result; SSE is overkill for MVP

3. **Config Security: File vs Keyring**
   - What we know: Keyring (zalando/go-keyring) is more secure, file is simpler
   - What's unclear: User environment (may not have keyring daemon)
   - Recommendation: Start with file-based (0600 permissions), document keyring as future enhancement

4. **Binary Distribution**
   - What we know: Need to distribute compiled binary
   - What's unclear: Release process (goreleaser? manual? homebrew?)
   - Recommendation: Use goreleaser for cross-platform builds; plan as Phase 6.5 follow-up

## Sources

### Primary (HIGH confidence)
- [spf13/cobra GitHub](https://github.com/spf13/cobra) - Official documentation, features, patterns
- [spf13/viper GitHub](https://github.com/spf13/viper) - Configuration management docs
- [go-resty/resty GitHub](https://github.com/go-resty/resty) - HTTP client features, middleware
- [olekukonko/tablewriter GitHub](https://github.com/olekukonko/tablewriter) - Table formatting docs
- [briandowns/spinner GitHub](https://github.com/briandowns/spinner) - Progress indicator patterns
- Backend source code: `/Users/vmiller/projects/time-tracker/backend/src/` - Existing auth patterns

### Secondary (MEDIUM confidence)
- [OneUptime Go Cobra CLI Tutorial](https://oneuptime.com/blog/post/2026-01-07-go-cobra-cli/view) - 2026 best practices
- [OneUptime Go Viper Configuration](https://oneuptime.com/blog/post/2026-01-07-go-viper-configuration/view) - 2026 config patterns
- [JetBrains Go Error Handling](https://www.jetbrains.com/guide/go/tutorials/handle_errors_in_go/best_practices/) - Exit code patterns

### Tertiary (LOW confidence)
- [Go Modules Beginner Guide 2026](https://www.igmguru.com/blog/go-modules) - Module initialization (verify with go.dev)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are well-established, widely used, officially documented
- Architecture: HIGH - Cobra+Viper pattern is the de-facto standard, used by kubectl
- Pitfalls: MEDIUM - Auth token CLI flow is inferred from web implementation analysis
- Backend requirements: HIGH - Directly analyzed existing backend code

**Research date:** 2026-01-22
**Valid until:** 2026-03-22 (60 days - Go CLI ecosystem is stable)
