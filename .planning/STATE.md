# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-19)

**Core value:** See all worked hours in one place — regardless of which system tracked them.
**Current focus:** Phase 1: Authentication & Security

## Current Position

Phase: 1 of 7 (Authentication & Security)
Plan: 4 of 4 in phase complete
Status: Phase complete
Last activity: 2026-01-21 — Completed 01-04-PLAN.md (End-to-End Auth Verification)

Progress: [██████████] 100% (Phase 1: 4/4 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: 6.5 min
- Total execution time: 0.43 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-authentication-a-security | 4/4 (complete) | 26 min | 6.5 min |

**Recent Trend:**
- Last 5 plans: 01-01 (6min), 01-02 (5min), 01-03 (4min), 01-04 (11min)
- Trend: Verification plan longer due to debugging (6→5→4→11min)

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

### Pending Todos

None yet.

### Blockers/Concerns

**Resolved in 01-04:**
- ~~Rate limiting too aggressive~~ → Fixed: Scoped to login endpoint only
- ~~Frontend loses auth on refresh~~ → Fixed: Session restoration on page load
- ~~Refresh endpoint rate limited~~ → Fixed: Excluded from rate limiting

**Open concerns:**
- CORS configuration in backend hardcodes frontend URL to localhost:5173 - may need adjustment if frontend port changes or for production deployment.

## Session Continuity

Last session: 2026-01-21T00:38:16Z (plan execution)
Stopped at: Completed 01-04-PLAN.md (End-to-End Auth Verification)
Resume file: None
Next: Phase 1 complete - ready for Phase 2 planning
