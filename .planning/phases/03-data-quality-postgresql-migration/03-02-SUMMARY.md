---
phase: 03-data-quality-postgresql-migration
plan: 02
subsystem: api
tags: [tempo, jira, data-quality, error-handling]

# Dependency graph
requires:
  - phase: 01-authentication-a-security
    provides: Protected API routes and authentication middleware
provides:
  - Tempo service extracts and displays Jira issue keys (e.g., "ABC-27 - Project Name")
  - JIRA_BASE_URL configuration for frontend link generation
  - Duplicate detection with P2002 error handling that fails sync on collision
  - /api/config/jira endpoint for frontend Jira configuration
affects: [frontend-integration, data-quality, reporting]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Issue key extraction from Tempo API v4 response (entry.issue.key)
    - Formatted project display: "KEY - Name" or fallback to "Issue #ID"
    - Strict collision handling: fail on P2002 with descriptive error
    - Environment-based feature configuration via /config/* endpoints

key-files:
  created: []
  modified:
    - backend/src/services/tempo.service.ts
    - backend/.env.example
    - backend/src/server.ts
    - docker-compose.yml

key-decisions:
  - "Prioritize entry.issue.key over entry.issue.id for readable issue identifiers"
  - "Combine issue key with project name in format 'KEY - Name' for better context"
  - "Fail sync on duplicate entries (P2002) instead of silently skipping"
  - "Expose JIRA_BASE_URL via /api/config/jira for frontend link construction"
  - "Return sync metadata (issueKeysResolved, issueKeysFallback) for monitoring"

patterns-established:
  - "Config endpoints pattern: GET /api/config/{service} returns frontend-relevant settings"
  - "Sync error handling: catch Prisma P2002 and throw descriptive domain error"
  - "Logging pattern: log issue resolution strategy for debugging"

# Metrics
duration: 1min
completed: 2026-01-21
---

# Phase 03 Plan 02: Tempo Service Enhancement Summary

**Tempo service now extracts Jira issue keys from API responses, displays them in readable format ("ABC-27 - Project Name"), and fails sync on duplicate entries with clear error messages**

## Performance

- **Duration:** 1 min
- **Started:** 2026-01-21T03:33:42Z
- **Completed:** 2026-01-21T03:35:24Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Issue keys extracted from Tempo API v4 responses (entry.issue.key)
- Project display format: "ABC-27 - Project Name" with fallback to "Issue #ID"
- Duplicate entry detection throws descriptive error instead of silent skip
- JIRA_BASE_URL configuration documented and passed to backend
- New /api/config/jira endpoint exposes Jira configuration to frontend

## Task Commits

Each task was committed atomically:

1. **Task 1: Update Tempo Service for Issue Key Display** - `0e00f5a` (feat)
2. **Task 2: Add JIRA_BASE_URL Configuration** - `0271d08` (chore)
3. **Task 3: Add API Endpoint for Jira Configuration** - `c40dbba` (feat)

## Files Created/Modified
- `backend/src/services/tempo.service.ts` - Extract issue.key, format display, handle P2002 collision errors
- `backend/.env.example` - Document JIRA_BASE_URL with example value
- `backend/src/server.ts` - Add GET /api/config/jira endpoint
- `docker-compose.yml` - Pass JIRA_BASE_URL from host environment to backend container

## Decisions Made

**Issue key extraction strategy:**
- Prioritize entry.issue.key over entry.issue.id for human-readable identifiers
- Combine key with project name: "ABC-27 - Project Name" for better context
- Fallback to "Issue #ID" when key not available (backward compatible)

**Collision handling:**
- Fail sync on duplicate entries (P2002) instead of silently skipping
- Throw descriptive error with issue key and date for debugging
- Prevents silent data corruption from duplicate syncs

**Configuration pattern:**
- JIRA_BASE_URL configurable via environment variable
- Exposed to frontend via /api/config/jira endpoint
- Enables frontend to conditionally show Jira links based on configuration

**Monitoring:**
- Return issueKeysResolved and issueKeysFallback counts in sync response
- Log issue key resolution strategy for each entry
- Helps identify API response issues or missing data

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed as specified without problems.

## User Setup Required

**Environment variable configuration required for Jira link functionality:**

Add to `.env` file (or host environment for Docker):
```bash
JIRA_BASE_URL=https://your-company.atlassian.net
```

Without this configuration:
- Issue keys will still display correctly
- Frontend will receive `configured: false` from /api/config/jira
- Jira link functionality can be hidden/disabled

Verification:
```bash
# Start backend
cd backend && npm run dev

# Check config endpoint (requires authentication)
curl -X GET http://localhost:3000/api/config/jira \
  -H "Authorization: Bearer $TOKEN"

# Should return: {"baseUrl":"https://...","configured":true}
```

## Next Phase Readiness

**Ready for frontend integration:**
- Issue keys available in project field for all Tempo entries
- /api/config/jira endpoint ready for frontend consumption
- Collision detection prevents duplicate data corruption

**Blockers/Concerns:**
- None - all functionality implemented and verified

**Future improvements (out of scope for this plan):**
- Frontend UI to display clickable Jira links when JIRA_BASE_URL configured
- Pagination handling for Tempo API (currently limited to 1000 entries)
- Issue key caching to reduce API calls

---
*Phase: 03-data-quality-postgresql-migration*
*Completed: 2026-01-21*
