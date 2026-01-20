# Requirements

## Version 1: Deployment MVP + Enhancements

### REQ-001: Single User Authentication
**Priority:** High
**Status:** Active
**Description:** User can log in with credentials (single user initially)

**Acceptance Criteria:**
- Login form accepts username and password
- Fastify JWT authentication protects all API routes
- Session management with HttpOnly cookies
- Logout functionality clears session
- Architecture supports future multi-user expansion

**Technical Notes:**
- Use `@fastify/jwt` plugin for Fastify-based auth
- Store JWT in HttpOnly cookies (not localStorage)
- Session regeneration after login to prevent fixation attacks
- Refresh token pattern for long-lived sessions

**Related Research:** `.planning/research/stack.md`, `.planning/research/pitfalls.md`

---

### REQ-002: Docker Containerization
**Priority:** High
**Status:** Active
**Description:** Application runs in Docker containers

**Acceptance Criteria:**
- Separate Dockerfiles for frontend and backend
- Multi-stage builds reduce image size to ~150MB
- Health checks for all services
- Development and production configurations
- Alpine-based images for security

**Technical Notes:**
- Frontend: Node build stage + Nginx serve stage
- Backend: Node build + production dependencies only
- Use Docker Secrets for production API tokens
- Network isolation between services

**Related Research:** `.planning/research/stack.md`, `.planning/research/architecture.md`

---

### REQ-003: Docker Compose Orchestration
**Priority:** High
**Status:** Active
**Description:** Docker Compose orchestrates frontend, backend, database

**Acceptance Criteria:**
- Single `docker-compose.yml` for local development
- Separate `docker-compose.prod.yml` for production
- Service dependencies with health checks
- Volume management for database persistence
- Environment variable configuration
- Proper network isolation

**Technical Notes:**
- Three-tier network architecture (frontend, backend, database)
- PostgreSQL health check: `pg_isready -U user -d db`
- Backend health check: curl to `/health` endpoint
- Startup order: database → backend → frontend

**Related Research:** `.planning/research/architecture.md`, `.planning/research/pitfalls.md`

---

### REQ-004: Tempo Issue Key Resolution
**Priority:** Medium
**Status:** Active
**Description:** Tempo API resolves internal IDs to readable issue keys (ABC-27 vs "Issue #24990")

**Acceptance Criteria:**
- Tempo entries display Jira issue keys (e.g., "ABC-27")
- Fallback to internal ID if key resolution fails
- Cache issue key mappings to reduce API calls
- Handle missing or deleted issues gracefully

**Technical Notes:**
- Use Tempo API `/worklogs/{worklogId}` to get issue details
- Cache issue mappings in database table
- Update sync service to fetch issue keys during import

**Related Research:** `.planning/research/architecture.md` (Provider abstraction)

---

### REQ-005: PostgreSQL Database Migration
**Priority:** High
**Status:** Active
**Description:** PostgreSQL replaces SQLite for production

**Acceptance Criteria:**
- Prisma schema supports both SQLite (dev) and PostgreSQL (prod)
- Migration script transfers existing SQLite data to PostgreSQL
- DateTime fields use `@db.Timestamptz(6)` for timezone support
- Boolean fields properly mapped between SQLite and PostgreSQL
- Connection pooling configured for production load

**Technical Notes:**
- Use pgloader for automated migration
- Update Prisma schema datetime fields to use Timestamptz
- Test migration with real data before production
- Keep SQLite for local development

**Related Research:** `.planning/research/pitfalls.md` (SQLite → PostgreSQL issues)

---

### REQ-006: Light/Dark Theme Toggle
**Priority:** Medium
**Status:** Active
**Description:** User can switch between light and dark themes

**Acceptance Criteria:**
- Theme toggle button in dashboard header
- Persists preference in localStorage
- Respects system preference as default
- All components properly styled for both themes
- Chart colors adjusted for dark mode readability

**Technical Notes:**
- Use Tailwind's built-in dark mode (`darkMode: 'class'`)
- Create `useTheme` hook for state management
- Update Recharts configuration for dark mode colors
- Add theme class to root HTML element

**Related Research:** `.planning/research/features.md` (Dark mode patterns)

---

### REQ-007: CSV Export
**Priority:** Medium
**Status:** Active
**Description:** User can export filtered data as CSV

**Acceptance Criteria:**
- Export button in dashboard header
- Generates CSV from currently filtered entries
- Includes all relevant fields (date, hours, source, description, project)
- Properly escapes special characters
- Downloads with meaningful filename (e.g., `timetracker-2026-01-01-to-2026-01-31.csv`)

**Technical Notes:**
- Use `export-to-csv` library (client-side generation)
- Sanitize data to prevent CSV injection
- Apply current filters to export
- Include headers with human-readable column names

**Related Research:** `.planning/research/features.md` (CSV export patterns)

---

### REQ-008: PDF Export
**Priority:** Low
**Status:** Active
**Description:** User can export filtered data as PDF

**Acceptance Criteria:**
- Export PDF button in dashboard header
- Generates PDF from currently filtered entries
- Includes chart visualization
- Includes table of entries
- Professional formatting with headers/footers
- Generates within 3 seconds

**Technical Notes:**
- Use Puppeteer for server-side PDF generation
- Render existing React components in headless browser
- Backend endpoint: POST `/api/export/pdf`
- Return PDF as blob for download

**Related Research:** `.planning/research/features.md` (PDF export patterns)

---

### REQ-009: Robust Synthetic ID Generation
**Priority:** Medium
**Status:** Active
**Description:** Synthetic ID generation handles edge cases robustly

**Acceptance Criteria:**
- No duplicate IDs generated across sources
- Handles concurrent requests safely
- Proper fallback for missing source IDs
- Idempotent sync operations
- UUID v7 or Cuid2 for better performance

**Technical Notes:**
- Use UUID v7 (time-ordered) or Cuid2 (collision-resistant)
- Add idempotency token field to schema
- Implement fuzzy duplicate detection (time window + duration matching)
- Handle Prisma upsert race conditions

**Related Research:** `.planning/research/pitfalls.md` (ID conflicts, race conditions)

---

### REQ-010: Manual Time Entry
**Priority:** High
**Status:** Active
**Description:** User can add manual time entries directly

**Acceptance Criteria:**
- "Add Entry" button opens modal form
- Form accepts: date, duration (or start/end time), description, project (optional), source tag
- Validates input (duration > 0, valid date)
- Saves to database with source = "MANUAL"
- Appears in dashboard immediately after save
- Supports editing and deletion like other entries

**Technical Notes:**
- Use React Hook Form + Zod for validation
- Duration input accepts "2.5" or "2h 30m" formats
- Optional toggle to switch between duration and start/end time modes
- Reuse existing modal component pattern

**Related Research:** `.planning/research/features.md` (Manual entry UI patterns)

---

## Version 2: CLI Tool

### REQ-011: Go CLI - Today's Hours
**Priority:** Medium
**Status:** Active
**Description:** Go CLI shows today's worked hours

**Acceptance Criteria:**
- Command: `timetracker today`
- Displays total hours worked today
- Shows breakdown by source (Toggl, Tempo, Manual)
- Authenticates with backend API using JWT
- Returns exit code 0 on success, 1 on error

**Technical Notes:**
- Use Cobra for CLI framework
- Use Resty for HTTP client
- Config file at `~/.timetracker/config.yaml`
- API endpoint: GET `/api/entries/summary/today`

**Related Research:** `.planning/research/stack.md` (Go CLI tools), `.planning/research/architecture.md` (CLI-to-backend patterns)

---

### REQ-012: Go CLI - Weekly Summary
**Priority:** Medium
**Status:** Active
**Description:** Go CLI shows weekly summary

**Acceptance Criteria:**
- Command: `timetracker week`
- Displays total hours for current week (Monday-Sunday)
- Shows breakdown by day
- Shows breakdown by source
- Formatted as ASCII table

**Technical Notes:**
- Reuse JWT authentication from REQ-011
- API endpoint: GET `/api/entries/summary/week`
- Use tablewriter library for ASCII tables

**Related Research:** `.planning/research/stack.md`, `.planning/research/architecture.md`

---

### REQ-013: Go CLI - Trigger Sync
**Priority:** Medium
**Status:** Active
**Description:** Go CLI triggers sync via backend API

**Acceptance Criteria:**
- Command: `timetracker sync`
- Triggers backend to sync from all configured sources
- Shows progress indicator during sync
- Displays summary of new entries imported
- Handles sync errors gracefully

**Technical Notes:**
- API endpoint: POST `/api/sync`
- Long-polling or SSE for progress updates
- Timeout after 60 seconds if no response

**Related Research:** `.planning/research/architecture.md` (CLI-to-backend patterns)

---

## Version 3: Future Sources

### REQ-014: Clockify Integration
**Priority:** Low
**Status:** Active
**Description:** Clockify API integration

**Acceptance Criteria:**
- User can configure Clockify API key in settings
- Sync imports time entries from Clockify
- Entries tagged with source = "CLOCKIFY"
- Supports same operations as Toggl/Tempo (edit, delete, view)

**Technical Notes:**
- Implement ClockifyProvider extending Provider interface
- Clockify API: https://clockify.me/developers-api
- Cache strategy similar to Toggl

**Related Research:** `.planning/research/architecture.md` (Provider abstraction pattern)

---

### REQ-015: Clean Provider Abstraction
**Priority:** Medium
**Status:** Active
**Description:** Clean provider abstraction for adding new sources

**Acceptance Criteria:**
- Unified `Provider` interface for all time tracking sources
- `ProviderFactory` for creating providers
- `ProviderSyncService` orchestrator coordinates all providers
- Shared `CacheManager` for all providers
- Adding new source requires implementing one interface
- No duplicate sync logic across providers

**Technical Notes:**
- Refactor existing TogglService and TempoService to use Provider interface
- Interface methods: `sync()`, `validate()`, `getEntries()`, `getCachePath()`
- Factory pattern for provider instantiation
- Dependency injection for testability

**Related Research:** `.planning/research/architecture.md` (Provider abstraction detailed design)

---

## Out of Scope (Future Enhancements)

- **Multi-user authentication** — v1 is single user, architecture supports expansion
- **Mobile app** — web-first approach
- **Real-time sync** — manual trigger is sufficient
- **Billing/invoicing features** — export covers this need
- **Time tracking in CLI** — CLI is read-only + sync trigger
- **Offline mode** — requires PWA/service workers
- **Integrations beyond time tracking** — calendar sync, Slack notifications, etc.

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REQ-001 | Phase 1 | Complete |
| REQ-002 | Phase 2 | Pending |
| REQ-003 | Phase 2 | Pending |
| REQ-004 | Phase 3 | Pending |
| REQ-005 | Phase 3 | Pending |
| REQ-006 | Phase 4 | Pending |
| REQ-007 | Phase 4 | Pending |
| REQ-008 | Phase 4 | Pending |
| REQ-009 | Phase 3 | Pending |
| REQ-010 | Phase 5 | Pending |
| REQ-011 | Phase 6 | Pending |
| REQ-012 | Phase 6 | Pending |
| REQ-013 | Phase 6 | Pending |
| REQ-014 | Phase 7 | Pending |
| REQ-015 | Phase 5 | Pending |

**Coverage:** 15/15 requirements mapped (100%)

---

*Last updated: 2026-01-19*
