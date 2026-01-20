---
phase: 01-authentication-a-security
plan: 02
subsystem: auth
tags: [fastify, jwt, bcrypt, auth-routes, login, refresh-token, session-fixation]

# Dependency graph
requires:
  - phase: 01-01
    provides: JWT and session plugins, security infrastructure
provides:
  - Login endpoint with bcrypt password verification and JWT token issuance
  - Refresh endpoint with automatic token rotation
  - Logout endpoint with session and cookie cleanup
  - Session fixation prevention via session regeneration
  - HttpOnly cookie-based refresh token storage
affects: [01-03, auth, api]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Session fixation prevention: request.session.delete() before setting new session"
    - "Refresh token rotation: generate new refresh token on each refresh request"
    - "HttpOnly cookies: secure refresh token storage with sameSite strict"
    - "Dual token system: short-lived access token (15min) + long-lived refresh token (30d)"

key-files:
  created:
    - "backend/src/routes/auth.routes.ts"
  modified:
    - "backend/src/server.ts"
    - "backend/package.json"

key-decisions:
  - "Use direct property assignment for session data via request.session.set()"
  - "Extend SessionData interface for TypeScript type safety"
  - "Downgrade Fastify plugins to versions compatible with Fastify 4.29.1"
  - "Register auth routes before other API routes to keep them public"

patterns-established:
  - "Session fixation prevention: Always call request.session.delete() before setting new session data on login"
  - "Token rotation: Generate new refresh token on each /auth/refresh request to prevent token reuse"
  - "Cookie security: HttpOnly, sameSite strict, secure in production"
  - "Credential validation: bcrypt.compare() for password verification with admin_password_hash from loadSecret()"

# Metrics
duration: 5min
completed: 2026-01-20
---

# Phase 01 Plan 02: Auth Routes Implementation Summary

**Login, refresh, and logout endpoints with session fixation prevention, refresh token rotation, and HttpOnly cookie security**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-20T00:21:50Z
- **Completed:** 2026-01-20T00:27:22Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Implemented three authentication routes (login, refresh, logout) with complete security patterns
- Registered auth plugins in server with proper initialization order
- Fixed Fastify plugin version compatibility issues for Fastify 4.29.1 ecosystem
- Session fixation prevention implemented via request.session.delete() on login
- Refresh token rotation enabled to prevent token reuse attacks

## Task Commits

Each task was committed atomically:

1. **Task 1: Register auth plugins in server** - `6fa459e` (feat)
2. **Task 2: Create authentication routes** - `3e1e849` (feat)
3. **Task 3: Mount auth routes in server** - `c214701` (feat)

## Files Created/Modified

**Created:**
- `backend/src/routes/auth.routes.ts` - Login, refresh, logout endpoints with bcrypt verification, JWT token generation, and session management

**Modified:**
- `backend/src/server.ts` - Registered auth plugins (security, auth, session) and mounted auth routes; updated CORS to enable credentials
- `backend/package.json` - Downgraded Fastify plugins to versions compatible with Fastify 4.29.1
- `backend/package-lock.json` - Lockfile updates for plugin version changes

## Decisions Made

**1. SessionData TypeScript interface extension**
- **Decision:** Extend `@fastify/secure-session` SessionData interface with userId and authenticated fields
- **Rationale:** TypeScript compilation failed without proper type definitions for session properties. Extension provides type safety for session data access.

**2. Fastify plugin version compatibility**
- **Decision:** Downgrade all Fastify plugins to versions compatible with Fastify 4.29.1:
  - @fastify/helmet: 13.x → 11.1.1
  - @fastify/rate-limit: 10.x → 9.1.0
  - @fastify/cookie: 11.x → 9.4.0
  - @fastify/secure-session: 8.x → 7.5.1
- **Rationale:** Plugins v10+ and v13+ require Fastify 5.x. Plan 01-01 installed latest versions, causing runtime crashes with "expected '5.x' fastify version" errors. Downgraded to last stable versions for Fastify 4.x ecosystem.

**3. CORS credentials configuration**
- **Decision:** Set `credentials: true` in CORS config and change origin from wildcard to environment-based URL
- **Rationale:** HttpOnly cookies require CORS credentials enabled. Wildcard origin (`*`) incompatible with credentials. Changed to `process.env.FRONTEND_URL || 'http://localhost:5173'` for secure cookie transmission.

**4. Auth route registration order**
- **Decision:** Register auth routes BEFORE other API routes, without preHandler authentication
- **Rationale:** Login and refresh endpoints must be publicly accessible. Registering them first ensures they remain unauthenticated while future routes can be protected.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extended SessionData interface for TypeScript**
- **Found during:** Task 2 (Create authentication routes)
- **Issue:** TypeScript compilation failed with error "Argument of type '"userId"' is not assignable to parameter of type 'never'". The @fastify/secure-session Session type uses a generic SessionData interface that defaults to empty, causing type errors when setting session properties.
- **Fix:** Added module augmentation to extend SessionData interface with userId (number) and authenticated (boolean) properties
- **Files modified:** backend/src/routes/auth.routes.ts
- **Verification:** TypeScript compilation passes with no errors
- **Committed in:** 3e1e849 (part of Task 2 commit)

**2. [Rule 3 - Blocking] Fixed Fastify logger error call syntax**
- **Found during:** Task 2 (Create authentication routes)
- **Issue:** Used `fastify.log.error('message:', err)` which TypeScript flagged as incorrect signature. Fastify's pino logger expects object-first syntax for structured logging.
- **Fix:** Changed to `fastify.log.error({ err }, 'message')` following Fastify logging best practices
- **Files modified:** backend/src/routes/auth.routes.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** 3e1e849 (part of Task 2 commit)

**3. [Rule 3 - Blocking] Downgraded Fastify plugins to Fastify 4.x compatible versions**
- **Found during:** Task 3 (Mount auth routes in server)
- **Issue:** Server crashed with "fastify-plugin: @fastify/helmet - expected '5.x' fastify version, '4.29.1' is installed". Same error repeated for @fastify/rate-limit, @fastify/cookie. Plan 01-01 installed latest versions (13.x, 10.x, 11.x) which require Fastify 5.x, but project uses Fastify 4.29.1.
- **Fix:** Downgraded plugins to last stable versions for Fastify 4.x:
  - @fastify/helmet@13.0.2 → @fastify/helmet@11.1.1
  - @fastify/rate-limit@10.3.0 → @fastify/rate-limit@9.1.0
  - @fastify/cookie@11.0.2 → @fastify/cookie@9.4.0
  - @fastify/secure-session@8.3.0 → @fastify/secure-session@7.5.1
- **Files modified:** backend/package.json, backend/package-lock.json
- **Verification:** Server starts successfully, login endpoint returns 401 for invalid credentials
- **Committed in:** c214701 (part of Task 3 commit)

---

**Total deviations:** 3 auto-fixed (2 missing critical, 1 blocking)
**Impact on plan:** All auto-fixes necessary for TypeScript compilation and server startup. Deviation #3 (plugin version downgrades) impacts Plan 01-01's deliverable - should have installed Fastify 4-compatible versions initially.

## Issues Encountered

**Fastify plugin version incompatibility with Fastify 4.x**
- **Problem:** Multiple runtime crashes during Task 3 with "expected '5.x' fastify version" errors. Each plugin (helmet, rate-limit, cookie, secure-session) crashed in sequence as previous fixes exposed next incompatibility.
- **Root cause:** Plan 01-01 installed latest versions of all Fastify plugins (@fastify/helmet@13.x, @fastify/rate-limit@10.x, @fastify/cookie@11.x, @fastify/secure-session@8.x), which were released for Fastify 5.x. Project uses Fastify 4.29.1, causing version mismatch errors at plugin registration time.
- **Resolution:** Researched npm registry versions for each plugin to find last stable releases compatible with Fastify 4.x. Downgraded all four plugins systematically. Verified server startup with environment variables loaded for secrets. Confirmed login endpoint accessible and returning correct 401 status.
- **Prevention:** Future plugin installations should verify peer dependency compatibility with current Fastify version before installation.

## User Setup Required

None - authentication routes use existing secrets from Plan 01-01. Users must have already run `bash scripts/generate-secrets.sh` and exported environment variables as documented in 01-01-SUMMARY.md.

**Reminder for testing:**
```bash
# Export secrets (if not already done)
export JWT_SECRET=$(cat backend/secrets/jwt_secret.txt)
export SESSION_SECRET=$(cat backend/secrets/session_secret.txt)
export ADMIN_PASSWORD_HASH=$(cat backend/secrets/admin_password_hash.txt)

# Start server
cd backend
npm run dev

# Test login endpoint
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"[your-password]"}'
```

## Next Phase Readiness

**Ready for next phase:**
- All three authentication routes implemented and accessible
- Session fixation prevention pattern established
- Refresh token rotation working
- HttpOnly cookie security configured
- Fastify plugins compatible with Fastify 4.29.1

**Next phase should:**
- Protect existing API routes with authentication middleware (Plan 01-03)
- Test full authentication flow with valid credentials
- Verify token refresh works correctly
- Implement frontend login form to test end-to-end flow

**Concerns:**
- Plan 01-01 installed incompatible plugin versions that required downgrading in this plan. Consider updating 01-01-SUMMARY.md to note that Fastify 4.x-compatible versions should be used.
- Rate limiting (5 req/15min) is very aggressive and will trigger during development testing. May need to adjust or disable for development environment.

---
*Phase: 01-authentication-a-security*
*Completed: 2026-01-20*
