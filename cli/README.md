# TimeTracker CLI

A command-line interface for the TimeTracker application. Access your time tracking data from the terminal without needing to open a browser.

## Features

- **Login**: Securely authenticate and store credentials
- **Today**: View today's time summary
- **Week**: See weekly breakdown in ASCII table
- **Sync**: Trigger sync from Toggl/Tempo providers

## Installation

### Prerequisites

- Go 1.20 or higher
- Access to a running TimeTracker backend (default: `http://localhost:3000`)

### Build from Source

```bash
# Clone the repository and navigate to the CLI directory
cd cli

# Download dependencies
make deps

# Build the binary
make build

# The binary will be created as ./timetracker
```

### Install to System

```bash
# Install to $GOPATH/bin (make sure it's in your PATH)
make install
```

## Configuration

The CLI stores configuration in `~/.timetracker/config.yaml` with secure permissions (0600).

The config file contains:
- API URL
- Access token (JWT)
- Refresh token

**Security**: The config directory is created with `0700` permissions and the config file with `0600` permissions, ensuring only the current user can read the credentials.

## Usage

### Authentication

First, log in to authenticate:

```bash
# Interactive login (recommended - password is masked)
./timetracker login

# Or provide credentials via flags
./timetracker login --username admin --password yourpassword
```

### View Today's Summary

```bash
./timetracker today
```

Output:
```
📅 2024-01-22

⏱️  Total Hours: 8.50
📊 Entries: 5

Breakdown by Source:
  • TOGGL:   6.00h
  • TEMPO:   2.50h
```

### View Weekly Summary

```bash
./timetracker week
```

Output:
```
📆 Week: 2024-01-15 to 2024-01-21

┌─────┬────────────┬───────┐
│ Day │ Date       │ Hours │
├─────┼────────────┼───────┤
│ Mon │ 2024-01-15 │ 8.00  │
│ Tue │ 2024-01-16 │ 7.50  │
│ Wed │ 2024-01-17 │ 8.25  │
│ Thu │ 2024-01-18 │ 8.00  │
│ Fri │ 2024-01-19 │ 7.75  │
│ Sat │ 2024-01-20 │ 0.00  │
│ Sun │ 2024-01-21 │ 0.00  │
└─────┴────────────┴───────┘

⏱️  Total Hours: 39.50
📊 Total Entries: 25

Breakdown by Source:
  • TOGGL:   30.00h
  • TEMPO:   9.50h
```

### Sync Data

```bash
# Regular sync (incremental)
./timetracker sync

# Force full refresh
./timetracker sync --force
```

Output:
```
✓ Sync completed successfully!

📥 Imported: 12 entries
⏭️  Skipped: 3 entries

Provider Results:
  ✓ TOGGL:   imported: 8, skipped: 2
  ✓ TEMPO:   imported: 4, skipped: 1
```

### Global Flags

All commands support these flags:

- `--api-url`: Override the API base URL (default: `http://localhost:3000`)
- `--config`: Use a custom config file path

Example:
```bash
./timetracker --api-url https://timetracker.example.com today
```

## Development

### Project Structure

```
cli/
├── cmd/              # Cobra commands
│   ├── root.go       # Root command and config initialization
│   ├── login.go      # Login command
│   ├── today.go      # Today summary command
│   ├── week.go       # Weekly summary command
│   └── sync.go       # Sync command
├── internal/
│   ├── api/          # API client
│   │   ├── client.go # HTTP client with auto token refresh
│   │   ├── auth.go   # Authentication methods
│   │   └── types.go  # API response types
│   ├── config/       # Configuration management
│   │   └── config.go # Config file handling
│   └── display/      # Display utilities
│       └── table.go  # ASCII table renderer
├── main.go           # Entry point
├── go.mod            # Go module definition
└── Makefile          # Build automation

### Build Commands

```bash
make build       # Build binary
make build-all   # Cross-compile for multiple platforms
make install     # Install to $GOPATH/bin
make clean       # Remove build artifacts
make test        # Run tests
make deps        # Download dependencies
```

## Authentication Flow

1. User runs `timetracker login`
2. CLI prompts for username/password (password is masked)
3. CLI calls `/api/auth/cli-login` endpoint
4. Backend returns `accessToken` and `refreshToken` in response body
5. CLI saves tokens to `~/.timetracker/config.yaml` with 0600 permissions

For subsequent requests:
1. CLI loads tokens from config
2. CLI includes `accessToken` in `Authorization: Bearer` header
3. If token is expired, CLI automatically calls `/api/auth/cli-refresh`
4. New tokens are saved to config
5. Original request is retried with new token

## Security Notes

- Passwords are masked during interactive input
- Tokens are stored with restrictive file permissions (0600)
- Access tokens expire after 15 minutes
- Refresh tokens expire after 30 days
- Tokens are automatically refreshed before API requests
- CLI-specific auth endpoints return tokens in body (not cookies)

## Troubleshooting

### "not logged in" Error

Run `timetracker login` to authenticate.

### "failed to load config" Error

The config directory or file may have incorrect permissions. Delete `~/.timetracker/` and login again.

### "API error: 401" Error

Your tokens may have expired. Run `timetracker login` again.

### Connection Refused

Ensure the backend is running and accessible at the configured API URL (default: `http://localhost:3000`).

## License

Same as the parent TimeTracker project.
