---
phase: 01-authentication-a-security
plan: 01
subsystem: auth
tags: [fastify, jwt, bcrypt, secure-session, helmet, rate-limit, docker-secrets]

# Dependency graph
requires: []
provides:
  - JWT signing and verification infrastructure via @fastify/jwt
  - Secure session management with HttpOnly cookies via @fastify/secure-session
  - Security headers and rate limiting via @fastify/helmet and @fastify/rate-limit
  - Docker Secrets integration with loadSecret() utility
  - bcrypt password hashing capability
  - Secret generation tooling for development and production
affects: [01-02, 01-03, auth, api]

# Tech tracking
tech-stack:
  added:
    - "@fastify/jwt@8.0.1"
    - "@fastify/secure-session@8.3.0"
    - "@fastify/cookie@11.0.2"
    - "bcrypt@6.0.0"
    - "@fastify/helmet@13.0.2"
    - "@fastify/rate-limit@10.3.0"
    - "fastify-plugin"
  patterns:
    - "Docker Secrets with environment variable fallback via loadSecret()"
    - "Fastify plugin pattern using fastify-plugin wrapper"
    - "HttpOnly cookies for refresh tokens"
    - "15-minute JWT access token expiration"

key-files:
  created:
    - "backend/src/plugins/auth.ts"
    - "backend/src/plugins/session.ts"
    - "backend/src/plugins/security.ts"
    - "backend/scripts/generate-secrets.sh"
  modified:
    - "backend/package.json"
    - ".gitignore"

key-decisions:
  - "Use @fastify/jwt v8.x for Fastify 4 compatibility"
  - "Use 'key' parameter for @fastify/secure-session (libsodium) instead of 'secret'"
  - "Generate 64-byte JWT secret and 32-byte session secret"
  - "Rate limit to 5 requests per 15 minutes with health check allowlist"
  - "Store secrets in backend/secrets/ directory (gitignored)"

patterns-established:
  - "loadSecret(name): Reads from /run/secrets/{name} with fallback to process.env[NAME_UPPERCASE]"
  - "Secret validation: Minimum 32 characters for environment variable secrets"
  - "Session secret must be exactly 32 bytes for libsodium encryption"
  - "Plugin registration pattern: await fastify.register() within fp() wrapper"

# Metrics
duration: 6min
completed: 2026-01-20
---

# Phase 01 Plan 01: Backend Auth Infrastructure Summary

**JWT authentication, secure sessions with HttpOnly cookies, security headers, rate limiting, and Docker Secrets integration using Fastify ecosystem**

## Performance

- **Duration:** 6 min
- **Started:** 2026-01-20T00:13:18Z
- **Completed:** 2026-01-20T00:19:02Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Installed complete Fastify authentication ecosystem (@fastify/jwt, @fastify/secure-session, bcrypt, @fastify/helmet, @fastify/rate-limit)
- Created secure secret generation script with bcrypt password hashing (12 rounds)
- Implemented three Fastify plugins: auth (JWT + authenticate decorator), session (HttpOnly cookies), security (helmet + rate limiting)
- Established Docker Secrets integration pattern with development environment variable fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Install authentication dependencies** - `73c1cf0` (chore)
2. **Task 2: Create secure secret generation script** - `a60887a` (feat)
3. **Task 3: Create Fastify auth plugins** - `51cda86` (feat)

## Files Created/Modified

**Created:**
- `backend/src/plugins/auth.ts` - JWT plugin with @fastify/jwt, loadSecret() utility, and authenticate decorator
- `backend/src/plugins/session.ts` - Secure session plugin with @fastify/secure-session and HttpOnly cookie configuration
- `backend/src/plugins/security.ts` - Security headers via @fastify/helmet and rate limiting (5 req/15min)
- `backend/scripts/generate-secrets.sh` - Bash script to generate JWT secret (64 bytes), session secret (32 bytes), and bcrypt admin password hash

**Modified:**
- `backend/package.json` - Added auth dependencies and fastify-plugin
- `backend/package-lock.json` - Lockfile updates
- `.gitignore` - Added backend/secrets/ to prevent committing secrets

## Decisions Made

**1. @fastify/jwt version selection**
- **Decision:** Use @fastify/jwt v8.x (not v9.x)
- **Rationale:** Current Fastify version is 4.28.1, which requires @fastify/jwt v8.x. Version 9 is for Fastify 5 only.

**2. @fastify/secure-session secret parameter**
- **Decision:** Use `key: Buffer` parameter instead of `secret` + `salt`
- **Rationale:** TypeScript types show two options: `{ key: Buffer }` OR `{ secret: string, salt: string }`. Using `key` is simpler for single-key setup and matches libsodium's 32-byte key requirement.

**3. Secret storage and gitignore**
- **Decision:** Store generated secrets in `backend/secrets/` and add to .gitignore
- **Rationale:** Prevents accidental secret commits while keeping secrets easily accessible for Docker Compose file mounting in development.

**4. loadSecret() fallback pattern**
- **Decision:** Try Docker Secrets path first, fall back to environment variables
- **Rationale:** Supports production (Docker Secrets at /run/secrets/) and development (environment variables) with single codebase.

**5. Rate limiting configuration**
- **Decision:** 5 requests per 15 minutes with health check allowlist
- **Rationale:** RESEARCH.md pattern for brute-force prevention. Health checks exempted to avoid monitoring failures.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added fastify-plugin dependency**
- **Found during:** Task 3 (Create Fastify auth plugins)
- **Issue:** Plan specified using `fp()` from fastify-plugin but package wasn't in dependencies. TypeScript would fail to compile without it.
- **Fix:** Ran `npm install fastify-plugin` during Task 3 execution
- **Files modified:** backend/package.json, backend/package-lock.json
- **Verification:** TypeScript compilation passes with no errors
- **Committed in:** 51cda86 (part of Task 3 commit)

**2. [Rule 1 - Bug] Corrected @fastify/secure-session secret parameter**
- **Found during:** Task 3 (Create Fastify auth plugins)
- **Issue:** Initial implementation used `secret: Buffer` parameter, but TypeScript compilation failed. Type definition requires either `{ key: Buffer }` OR `{ secret: string, salt: string }`.
- **Fix:** Changed parameter from `secret` to `key` to match libsodium's single-key encryption pattern
- **Files modified:** backend/src/plugins/session.ts
- **Verification:** TypeScript compilation passes, matches official @fastify/secure-session types
- **Committed in:** 51cda86 (part of Task 3 commit)

**3. [Rule 2 - Missing Critical] Added @fastify/cookie plugin registration**
- **Found during:** Task 3 (Create Fastify auth plugins)
- **Issue:** @fastify/secure-session requires @fastify/cookie to be registered first for cookie handling
- **Fix:** Added `await fastify.register(fastifyCookie)` before registering secure session
- **Files modified:** backend/src/plugins/session.ts
- **Verification:** TypeScript compilation passes, follows @fastify/secure-session dependency requirements
- **Committed in:** 51cda86 (part of Task 3 commit)

---

**Total deviations:** 3 auto-fixed (2 missing critical, 1 bug)
**Impact on plan:** All auto-fixes necessary for correct compilation and proper plugin dependencies. No scope creep.

## Issues Encountered

**TypeScript type errors with @fastify/secure-session**
- **Problem:** Multiple TypeScript compilation errors when trying to register @fastify/secure-session with different parameter combinations
- **Root cause:** Type definition requires specific union type: `{ key: Buffer }` OR `{ secret: string, salt: string }`. Using only `secret: Buffer` didn't match either option.
- **Resolution:** Read type definition file at `node_modules/@fastify/secure-session/types/index.d.ts` to understand exact requirements. Switched from `secret` to `key` parameter.

## User Setup Required

**Before running the backend, secrets must be generated:**

1. Run the secret generation script:
   ```bash
   cd backend
   bash scripts/generate-secrets.sh
   ```

2. Enter admin password when prompted (will be hashed with bcrypt)

3. Verify secrets created:
   ```bash
   ls -la backend/secrets/
   # Should show: jwt_secret.txt, session_secret.txt, admin_password_hash.txt
   # All with 600 permissions (owner read/write only)
   ```

4. For development, export environment variables (alternative to Docker Secrets):
   ```bash
   export JWT_SECRET=$(cat backend/secrets/jwt_secret.txt)
   export SESSION_SECRET=$(cat backend/secrets/session_secret.txt)
   export ADMIN_PASSWORD_HASH=$(cat backend/secrets/admin_password_hash.txt)
   ```

5. For production, secrets will be mounted via Docker Compose at `/run/secrets/` (loadSecret() handles this automatically)

**Security reminder:** The `backend/secrets/` directory is gitignored. Keep these files secure and backed up separately.

## Next Phase Readiness

**Ready for next phase:**
- Auth infrastructure plugins created and type-checked
- Secret management pattern established (Docker Secrets + env var fallback)
- Security headers and rate limiting configured
- bcrypt password hashing available

**Next phase should:**
- Register these plugins in `backend/src/server.ts`
- Create login/logout/refresh endpoints using the auth plugin
- Implement user credential validation (single-user Phase 1)
- Test JWT token flow and session regeneration

**No blockers or concerns** - all planned infrastructure in place.

---
*Phase: 01-authentication-a-security*
*Completed: 2026-01-20*
