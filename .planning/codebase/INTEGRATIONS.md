# External Integrations

**Analysis Date:** 2026-01-19

## APIs & External Services

**Time Tracking APIs:**
- Toggl Track API (v9) - Time entry synchronization
  - SDK/Client: axios
  - Auth: Basic Auth via TOGGL_API_TOKEN env var
  - Endpoint: `https://api.track.toggl.com/api/v9/me/time_entries`
  - Implementation: `/Users/vmiller/projects/time-tracker/backend/src/services/toggl.service.ts`
  - Cache: Local file cache (`toggl_cache.json`) with 10-minute TTL
  - Rate limiting: Not implemented

- Tempo Timesheets API (v4) - Jira time tracking integration
  - SDK/Client: axios
  - Auth: Bearer token via TEMPO_API_TOKEN env var
  - Endpoint: `https://api.tempo.io/4/worklogs`
  - Implementation: `/Users/vmiller/projects/time-tracker/backend/src/services/tempo.service.ts`
  - Cache: Local file cache (`tempo_cache.json`) with 10-minute TTL
  - Rate limiting: Not implemented

## Data Storage

**Databases:**
- SQLite (via Prisma ORM)
  - Connection: DATABASE_URL env var (default: `file:./dev.db`)
  - Client: @prisma/client 5.19.1
  - Schema: `/Users/vmiller/projects/time-tracker/backend/prisma/schema.prisma`
  - Migrations: `/Users/vmiller/projects/time-tracker/backend/prisma/migrations/`
  - Database file: `/Users/vmiller/projects/time-tracker/backend/prisma/dev.db`

**File Storage:**
- Local filesystem only
  - CSV uploads: Handled in-memory via `@fastify/multipart`
  - Cache files: Written to backend root directory (`.gitignored`)

**Caching:**
- File-based JSON caching
  - Toggl cache: `/Users/vmiller/projects/time-tracker/backend/toggl_cache.json`
  - Tempo cache: `/Users/vmiller/projects/time-tracker/backend/tempo_cache.json`
  - TTL: 10 minutes (600,000ms)
  - Invalidation: Force refresh flag or custom date range bypasses cache

## Authentication & Identity

**Auth Provider:**
- None (application-level authentication not implemented)
  - External API authentication only (Toggl/Tempo tokens)
  - CORS configured to allow all origins (`origin: '*'`)
  - No user sessions or JWT

## Monitoring & Observability

**Error Tracking:**
- None (no external service integration)

**Logs:**
- Fastify built-in logger (Pino)
  - Configured in `/Users/vmiller/projects/time-tracker/backend/src/server.ts`
  - Console output only
  - No log aggregation service

## CI/CD & Deployment

**Hosting:**
- Not configured (local development only)

**CI Pipeline:**
- None detected

## Environment Configuration

**Required env vars:**
- PORT - Server port (default: 3000)
- DATABASE_URL - Prisma database connection string
- TOGGL_API_TOKEN - Toggl Track API authentication token
- TEMPO_API_TOKEN - Tempo Timesheets API authentication token

**Secrets location:**
- Backend: `/Users/vmiller/projects/time-tracker/backend/.env` (gitignored)
- Example file: `/Users/vmiller/projects/time-tracker/backend/.env.example`
- Frontend: No environment variables configured

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Development Proxy

**Frontend → Backend:**
- Vite dev server proxies `/api/*` requests to `http://localhost:3000`
- Configuration: `/Users/vmiller/projects/time-tracker/frontend/vite.config.ts`
- Enables frontend development on different port with seamless API access

---

*Integration audit: 2026-01-19*
