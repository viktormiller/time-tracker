# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-19)

**Core value:** See all worked hours in one place — regardless of which system tracked them.
**Current focus:** Phase 1: Authentication & Security

## Current Position

Phase: 1 of 7 (Authentication & Security)
Plan: 3 of 4 in phase complete
Status: In progress
Last activity: 2026-01-20 — Completed 01-03-PLAN.md (Frontend Auth Integration)

Progress: [██████░░░░] 75% (Phase 1: 3/4 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 5 min
- Total execution time: 0.25 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-authentication-a-security | 3/4 | 15 min | 5 min |

**Recent Trend:**
- Last 5 plans: 01-01 (6min), 01-02 (5min), 01-03 (4min)
- Trend: Improving velocity (trending down from 6min to 4min)

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

### Pending Todos

None yet.

### Blockers/Concerns

**From 01-02:**
- Rate limiting (5 req/15min) is very aggressive and may trigger during development testing. Consider adjusting or disabling for development environment.
- Plan 01-01 installed incompatible Fastify plugin versions (for Fastify 5.x) that required downgrading in 01-02. Future plugin installations should verify peer dependency compatibility.

**From 01-03:**
- Frontend loses authentication on page refresh (access token in memory is lost). This is by design for security, but may want to add refresh-on-load logic to check if refresh token cookie is still valid.
- CORS configuration in backend hardcodes frontend URL to localhost:5173 - may need adjustment if frontend port changes.

## Session Continuity

Last session: 2026-01-20T00:33:45Z (plan execution)
Stopped at: Completed 01-03-PLAN.md (Frontend Auth Integration)
Resume file: None
Next: Plan 01-04 (final plan in Phase 1)
