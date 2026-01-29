# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-19)

**Core value:** See all worked hours in one place — regardless of which system tracked them.
**Current focus:** All planned phases complete

## Current Position

Phase: 6 of 6 (All phases complete)
Plan: All 16 plans completed
Status: Milestone complete - ready for new phase planning
Last activity: 2026-01-29 — Removed Phase 7 (Future Sources - deferred)

Progress: [████████████████████] 100% (18/18 total phases complete, 2 pre-existing)

## Performance Metrics

**Velocity:**
- Total plans completed: 16
- Average duration: 74.5 min
- Total execution time: 19.8 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-authentication-a-security | 4/4 (complete) | 26 min | 6.5 min |
| 02-containerization-a-deployment | 4/4 (complete) | 31 min | 7.8 min |
| 03-data-quality-postgresql-migration | 4/4 (complete) | 35 min | 8.8 min |
| 04-ux-enhancements | 4/4 (complete) | 1096 min | 274 min |
| 05-manual-entry-a-provider-abstraction | Pre-existing | - | - |
| 06-cli-tool | Pre-existing | - | - |

**Recent Trend:**
- Last 5 plans: 03-03 (3min), 03-04 (30min), 04-01 (7min), 04-02 (4min), 04-03 (3min), 04-04 (1082min)
- Trend: Plan 04-04 extended significantly for comprehensive dark mode polish based on user feedback

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Single user auth first: Faster to deployment, simpler security
- Go for CLI: Developer familiarity, single binary distribution
- CLI via backend API: Single source of truth, no duplicate API logic
- Docker Compose: Simplifies multi-container deployment

**From 01-01 (Backend Auth Infrastructure):**
- Use @fastify/jwt v8.x for Fastify 4 compatibility
- Use 'key' parameter for @fastify/secure-session (libsodium) instead of 'secret'
- Generate 64-byte JWT secret and 32-byte session secret
- Rate limit to 5 requests per 15 minutes with health check allowlist
- Store secrets in backend/secrets/ directory (gitignored)
- loadSecret() pattern: Docker Secrets (/run/secrets/) with env var fallback

**From 01-02 (Auth Routes Implementation):**
- Use direct property assignment for session data via request.session.set()
- Extend SessionData interface for TypeScript type safety
- Downgrade Fastify plugins to versions compatible with Fastify 4.29.1
- Register auth routes before other API routes to keep them public
- Session fixation prevention: Always call request.session.delete() before setting new session data on login
- Token rotation: Generate new refresh token on each /auth/refresh request

**From 01-03 (Frontend Auth Integration):**
- Use Fastify plugin with onRequest hook to protect all API routes in one place
- Store access token in React state (memory) instead of localStorage for XSS protection
- Axios interceptor handles 401 responses globally with automatic refresh retry
- Conditional rendering: show login form when not authenticated, dashboard when authenticated

**From 01-04 (End-to-End Auth Verification):**
- Rename auth.ts to auth.tsx for JSX support in AuthProvider
- Add session restoration on page load to prevent re-login after refresh
- Scope rate limiting to login endpoint only (5 req/15min) instead of global
- Exclude refresh endpoint from rate limiting to prevent blocking token renewal
- Use .env file for development secrets instead of shell exports

**From 02-01 (Backend Containerization):**
- Use node:22-slim instead of Alpine for bcrypt native binding compatibility
- Health endpoint performs database connectivity check (SELECT 1) at /health
- PostgreSQL configuration requires DATABASE_URL environment variable
- Docker CMD runs prisma migrate deploy before starting server
- Multi-stage builds: builder stage compiles, production stage runs
- Non-root user execution (USER node) for security

**From 02-02 (Frontend Containerization):**
- Use node:22-alpine for build stage (frontend has no native modules)
- Use nginx:alpine for serve stage (lightweight production web server)
- Configure nginx to proxy /api/, /auth/, and /health to backend:3000
- Enable SPA fallback routing with try_files $uri $uri/ /index.html
- Forward cookies through nginx proxy for authentication
- Cache static assets with 1-year expiry (safe with Vite content hashing)
- Enable gzip compression for text-based assets

**From 02-03 (Docker Compose Orchestration):**
- Development uses hardcoded credentials in environment variables
- Production uses Docker Secrets for all sensitive values
- PostgreSQL 17 Alpine image for lightweight database
- Health checks ensure proper startup order (db -> backend -> frontend)
- Only port 80 exposed to host (database and backend internal only)
- Separate backend-network and frontend-network for isolation
- Secret generation: openssl rand for crypto-secure random values
- Admin password: user-provided, bcrypt-hashed via Node.js

**From 02-04 (End-to-End Docker Stack Verification):**
- Generate bcrypt password hash inside running container to avoid escaping issues
- Add isRefreshing global flag to prevent infinite auth refresh loops
- Skip interceptor retry for all /auth/* endpoints to break refresh cycles
- Docker volume persistence verified with restart cycle testing
- Browser verification catches UX issues not visible in curl tests

**From 03-01 (Schema Migration):**
- Use PostgreSQL native gen_random_uuid() for database-level UUID generation
- Use TIMESTAMPTZ(6) for microsecond precision timezone-aware timestamps
- Expose PostgreSQL port 5432 in development docker-compose for local migrations
- Use pgloader for SQLite to PostgreSQL migration with automatic type conversion
- Validate migration with count checks, null ID detection, and duplicate verification
- PostgreSQL 17 has gen_random_uuid() built-in (no pgcrypto extension needed)

**From 03-02 (Tempo Service Enhancement):**
- Prioritize entry.issue.key over entry.issue.id for readable issue identifiers
- Combine issue key with project name in format "KEY - Name" for better context
- Fail sync on duplicate entries (P2002) instead of silently skipping
- Expose JIRA_BASE_URL via /api/config/jira for frontend link construction
- Return sync metadata (issueKeysResolved, issueKeysFallback) for monitoring
- Config endpoints pattern: GET /api/config/{service} returns frontend-relevant settings

**From 03-03 (Frontend Enhancements):**
- Use localStorage for timezone preference persistence (no backend state needed)
- Auto-detect browser timezone as default on first load
- Make only Tempo entries clickable (Toggl projects are not Jira issues)
- Extract issue key from project string format "KEY-123 - Project Name"
- React 19 uses new JSX transform (no explicit React import needed)

**From 03-04 (End-to-End Verification):**
- Display time in date column for transparency (users can see exact timestamps)
- Use externalId as secondary sort key (matches chronological order from APIs)
- Create root .env file for Docker Compose environment variables
- Set /app directory ownership to node user before switching to non-root
- Tempo entries show 09:00 time (expected - Tempo API only provides dates)
- Sorting: Primary by date+time desc, secondary by externalId desc, fallback by createdAt desc

**From 04-02 (CSV Export):**
- Sanitize CSV fields starting with =, +, -, @ by prefixing with single quote to prevent formula injection
- Use German column headers (Datum, Stunden, Quelle, Beschreibung, Projekt) matching UI language
- Include date range in filename: timetracker-YYYY-MM-DD-to-YYYY-MM-DD.csv
- Alert user when no entries available instead of downloading empty CSV
- Green button styling for export (vs indigo for import) for visual differentiation

**From 04-03 (Backend PDF Generation):**
- Use Puppeteer for server-side PDF generation (better quality than client-side solutions)
- Use system Chromium in Docker instead of bundled version (smaller image size, saves ~170MB)
- German locale for date formatting using date-fns with de locale
- HTML inline styles for PDF compatibility (no external CSS)
- Escape HTML in user content to prevent XSS in PDF generation
- Fastify logger object-first format: `fastify.log.error({ error }, 'message')`

**From 04-01 (Dark Mode Toggle):**
- Use Tailwind darkMode: 'selector' for class-based theming (v3.4+ syntax)
- Toggle between explicit 'light' and 'dark' modes (not 'system') for user clarity
- Apply dark class to documentElement for global theme control
- Use inline FOUC prevention script in HTML head before stylesheets
- Dynamic chart colors via isDarkMode variable instead of CSS-only approach
- Dark mode palette: gray-900 for backgrounds, gray-800 for cards, gray-700 for inputs

**From 04-02 (CSV Export):**
- Sanitize CSV fields starting with =, +, -, @ by prefixing with single quote to prevent formula injection
- Use German column headers (Datum, Stunden, Quelle, Beschreibung, Projekt) matching UI language
- Include date range in filename: timetracker-YYYY-MM-DD-to-YYYY-MM-DD.csv
- Alert user when no entries available instead of downloading empty CSV
- Green button styling for export (vs indigo for import) for visual differentiation

**From 04-03 (PDF Export Backend):**
- Use Puppeteer for server-side PDF generation (better quality than client-side solutions)
- Use system Chromium in Docker instead of bundled version (smaller image size, saves ~170MB)
- German locale for date formatting using date-fns with de locale
- HTML inline styles for PDF compatibility (no external CSS)
- Escape HTML in user content to prevent XSS in PDF generation
- Fastify logger object-first format: `fastify.log.error({ error }, 'message')`

**From 04-04 (PDF Export Frontend & Dark Mode Polish):**
- Use react-select for all dropdowns to ensure visual consistency
- Apply gradient backgrounds to calendar range start/end for visual polish
- Fix React hooks ordering by splitting auth check into separate component
- Use inline styles for third-party components (TimezoneSelector) to match dark mode
- Add react-select dependency for professional dropdown styling with keyboard navigation
- Use CSS important overrides for third-party calendar library dark mode
- Blob download pattern: axios blob responseType + URL.createObjectURL for binary files

**From Phase 5 (Manual Entry & Provider Abstraction - Pre-existing):**
- TimeProvider interface defines sync(), validate(), getName(), getCachePath() methods
- BaseTimeProvider abstract class provides shared logic: cache, upsert, date range calculation
- Provider pattern enables adding new time sources by extending BaseTimeProvider
- Manual entry form uses react-hook-form with zod validation for type safety
- Duration calculated automatically from start/end time with live preview
- Project field autocomplete from existing projects in database
- Manual entries tagged with "MANUAL" source for distinction from API syncs

**From Phase 6 (CLI Tool - Pre-existing):**
- Go CLI using cobra framework for command structure
- Config stored at ~/.timetracker/config.yaml with 0600 permissions (read-only by user)
- JWT authentication with access/refresh token pair stored in config
- CLI commands: login (interactive with password masking), today, week, sync
- Backend summary endpoints: GET /api/entries/summary/today, GET /api/entries/summary/week
- POST /api/sync endpoint triggers all provider syncs with optional force flag
- Table display for week command using custom display package

### Pending Todos

None yet.

### Blockers/Concerns

**All blockers resolved.**

**Resolved in 01-04:**
- ~~Rate limiting too aggressive~~ → Fixed: Scoped to login endpoint only
- ~~Frontend loses auth on refresh~~ → Fixed: Session restoration on page load
- ~~Refresh endpoint rate limited~~ → Fixed: Excluded from rate limiting

**Resolved in 02-03:**
- ~~Local development currently broken after 02-01 (needs DATABASE_URL or SQLite fallback)~~ → Fixed: docker-compose.yml provides PostgreSQL with DATABASE_URL

**Resolved in 02-04:**
- ~~Infinite 401 refresh loop after logout or in incognito mode~~ → Fixed: Added isRefreshing flag to prevent concurrent refresh attempts

**Resolved in 03-04:**
- ~~Timezone selector not visible~~ → Fixed: Frontend container rebuild
- ~~API tokens not loading~~ → Fixed: Created root .env + updated docker-compose.yml
- ~~Cache permission errors~~ → Fixed: Updated Dockerfile permissions
- ~~Time not displaying in date column~~ → Fixed: Changed format to include HH:mm
- ~~Entry order incorrect~~ → Fixed: Added secondary sort by externalId

## Session Continuity

Last session: 2026-01-29 (roadmap cleanup)
Stopped at: Removed Phase 7 (Future Sources - Clockify) from roadmap
Resume file: None
Next: Ready for new phase planning
