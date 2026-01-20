# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-19)

**Core value:** See all worked hours in one place — regardless of which system tracked them.
**Current focus:** Phase 1: Authentication & Security

## Current Position

Phase: 1 of 7 (Authentication & Security)
Plan: 2 of 4 in phase complete
Status: In progress
Last activity: 2026-01-20 — Completed 01-02-PLAN.md (Auth Routes Implementation)

Progress: [████░░░░░░] 50% (Phase 1: 2/4 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: 5.5 min
- Total execution time: 0.18 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-authentication-a-security | 2/4 | 11 min | 5.5 min |

**Recent Trend:**
- Last 5 plans: 01-01 (6min), 01-02 (5min)
- Trend: Consistent velocity (~6min per plan)

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

### Pending Todos

None yet.

### Blockers/Concerns

**From 01-02:**
- Rate limiting (5 req/15min) is very aggressive and may trigger during development testing. Consider adjusting or disabling for development environment.
- Plan 01-01 installed incompatible Fastify plugin versions (for Fastify 5.x) that required downgrading in 01-02. Future plugin installations should verify peer dependency compatibility.

## Session Continuity

Last session: 2026-01-20T00:27:22Z (plan execution)
Stopped at: Completed 01-02-PLAN.md (Auth Routes Implementation)
Resume file: None
Next: Plan 01-03 or continue with remaining Phase 1 plans
