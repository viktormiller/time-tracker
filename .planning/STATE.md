# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-19)

**Core value:** See all worked hours in one place — regardless of which system tracked them.
**Current focus:** Phase 2: Containerization & Deployment (complete) → Phase 3: Data Quality & PostgreSQL Migration

## Current Position

Phase: 2 of 7 (Containerization & Deployment) - COMPLETE
Plan: All 4 plans in phase complete
Status: Phase verified and complete
Last activity: 2026-01-21 — Verified phase 2 goal achievement

Progress: [████████░░] 80% (2/7 phases complete: Auth + Containerization)

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: 6.0 min
- Total execution time: 0.85 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-authentication-a-security | 4/4 (complete) | 26 min | 6.5 min |
| 02-containerization-a-deployment | 4/4 (complete) | 31 min | 7.8 min |

**Recent Trend:**
- Last 5 plans: 02-01 (2min), 02-02 (1min), 02-03 (3min), 02-04 (25min)
- Trend: Verification/debugging plans take longer than config-only plans

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

### Pending Todos

None yet.

### Blockers/Concerns

**Resolved in 01-04:**
- ~~Rate limiting too aggressive~~ → Fixed: Scoped to login endpoint only
- ~~Frontend loses auth on refresh~~ → Fixed: Session restoration on page load
- ~~Refresh endpoint rate limited~~ → Fixed: Excluded from rate limiting

**Open concerns:**
- CORS configuration in backend hardcodes frontend URL to localhost:5173 - may need adjustment if frontend port changes or for production deployment.

**Resolved in 02-03:**
- ~~Local development currently broken after 02-01 (needs DATABASE_URL or SQLite fallback)~~ → Fixed: docker-compose.yml provides PostgreSQL with DATABASE_URL

**Resolved in 02-04:**
- ~~Infinite 401 refresh loop after logout or in incognito mode~~ → Fixed: Added isRefreshing flag to prevent concurrent refresh attempts

## Session Continuity

Last session: 2026-01-21T02:04:02Z (plan execution)
Stopped at: Completed 02-04-PLAN.md (End-to-End Docker Stack Verification)
Resume file: None
Next: Phase 2 complete - ready for Phase 3 (Hetzner VPS deployment)
