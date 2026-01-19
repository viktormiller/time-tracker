# Codebase Concerns

**Analysis Date:** 2026-01-19

## Tech Debt

**Monolithic Frontend Component:**
- Issue: Entire application logic lives in a single 610-line `App.tsx` file with no component extraction or separation of concerns
- Files: `/Users/vmiller/projects/time-tracker/frontend/src/App.tsx`
- Impact: Difficult to test, maintain, or extend individual features. All state management, UI rendering, API calls, and business logic are tightly coupled.
- Fix approach: Extract components into separate files: `DateRangePicker.tsx`, `SyncModal.tsx`, `EditModal.tsx`, `TimeEntryTable.tsx`, `DailyChart.tsx`. Move API calls to custom hooks or service layer. Extract constants and types to separate files.

**Alert-Based User Feedback:**
- Issue: Using browser `alert()` for all user feedback (10 occurrences in `App.tsx`)
- Files: `/Users/vmiller/projects/time-tracker/frontend/src/App.tsx` (lines 98, 102, 115, 118, 119, 129, 132, 133, 270, 271)
- Impact: Poor UX, blocks UI, not accessible, cannot be styled or customized
- Fix approach: Implement toast notification system (e.g., react-hot-toast, sonner) for non-blocking feedback

**Hard-Coded API URLs:**
- Issue: API URL defined as constant `/api` assumes specific deployment setup
- Files: `/Users/vmiller/projects/time-tracker/frontend/src/App.tsx` (line 45)
- Impact: Cannot easily configure different API endpoints for dev/staging/production
- Fix approach: Use environment variables (VITE_API_URL) with fallback to `/api`

**Missing External ID for CSV Imports:**
- Issue: Synthetic IDs generated from timestamp + project name can collide if multiple entries exist with same timestamp/project
- Files: `/Users/vmiller/projects/time-tracker/backend/src/adapters/toggl-csv.adapter.ts` (line 50), `/Users/vmiller/projects/time-tracker/backend/src/adapters/tempo-csv.adapter.ts` (line 70)
- Impact: Duplicate entries may be created or legitimate separate entries may be overwritten on re-import
- Fix approach: Include more unique fields in synthetic ID generation (description hash, duration) or warn users about CSV limitations

**Wildcard CORS Policy:**
- Issue: CORS configured with `origin: '*'` allowing any domain
- Files: `/Users/vmiller/projects/time-tracker/backend/src/server.ts` (line 15)
- Impact: Any website can make requests to the API, potential security risk in production
- Fix approach: Configure allowed origins via environment variable, restrict to specific domains in production

**API Token Exposure Risk:**
- Issue: No validation that .env file exists or contains required tokens until runtime
- Files: `/Users/vmiller/projects/time-tracker/backend/src/services/toggl.service.ts` (line 15), `/Users/vmiller/projects/time-tracker/backend/src/services/tempo.service.ts` (line 14)
- Impact: Server starts successfully but fails on first sync attempt with unclear error
- Fix approach: Validate required environment variables on server startup, fail fast with clear message

**No Request Validation:**
- Issue: API endpoints accept raw request bodies without schema validation
- Files: `/Users/vmiller/projects/time-tracker/backend/src/server.ts` (all POST/PUT endpoints)
- Impact: Malformed requests can cause runtime errors or database corruption
- Fix approach: Add request schema validation using Fastify schema validation or Zod

## Known Bugs

**Debug Code in Production:**
- Symptoms: Console.log statements left in production code
- Files: `/Users/vmiller/projects/time-tracker/backend/src/services/tempo.service.ts` (lines 85-87), `/Users/vmiller/projects/time-tracker/frontend/src/App.tsx` (line 112)
- Trigger: Every Tempo sync and every backend payload submission logs to console
- Workaround: None needed but clutters logs

**German Debug Comments:**
- Symptoms: Debug comment in German: "DEBUG: Den ersten Eintrag loggen, damit wir die Struktur sehen"
- Files: `/Users/vmiller/projects/time-tracker/backend/src/services/tempo.service.ts` (line 85)
- Trigger: Present in codebase
- Workaround: Not affecting functionality, just inconsistent language

**Fallback External ID Generation:**
- Symptoms: Server uses random fallback IDs when CSV import doesn't provide external IDs
- Files: `/Users/vmiller/projects/time-tracker/backend/src/server.ts` (line 71)
- Trigger: When `entry.externalId` is null/undefined during CSV import
- Workaround: Using timestamp + random for uniqueness, but makes it impossible to detect duplicates on re-import

## Security Considerations

**Environment Variables Not Version Controlled:**
- Risk: `.env` file is gitignored, no `.env.example` template provided
- Files: `/Users/vmiller/projects/time-tracker/.gitignore` (line 3)
- Current mitigation: Documented in gitignore
- Recommendations: Add `.env.example` with placeholder values and documentation for required variables (TOGGL_API_TOKEN, TEMPO_API_TOKEN)

**API Tokens in Plaintext:**
- Risk: API tokens stored in `.env` file in plaintext
- Files: `/Users/vmiller/projects/time-tracker/backend/.env` (gitignored)
- Current mitigation: Gitignored, but still accessible if server is compromised
- Recommendations: For production, use secure secret management (AWS Secrets Manager, HashiCorp Vault, etc.)

**SQLite Database in Version Control:**
- Risk: Database file `dev.db` is modified and tracked in git
- Files: `/Users/vmiller/projects/time-tracker/backend/prisma/dev.db` (116KB, modified in git)
- Current mitigation: None - file is actively tracked
- Recommendations: Add `*.db` to `.gitignore`, use migrations only for schema, exclude data files from version control

**No Authentication/Authorization:**
- Risk: All API endpoints are public - anyone with network access can read/modify/delete all time entries
- Files: `/Users/vmiller/projects/time-tracker/backend/src/server.ts` (all routes)
- Current mitigation: Relies on network-level security only
- Recommendations: Implement authentication middleware (JWT, session-based) and user-specific data filtering

**No Rate Limiting:**
- Risk: API has no rate limiting on sync endpoints
- Files: `/Users/vmiller/projects/time-tracker/backend/src/server.ts` (lines 102, 121)
- Current mitigation: None
- Recommendations: Add rate limiting plugin (@fastify/rate-limit) to prevent API abuse and external API quota exhaustion

## Performance Bottlenecks

**Synchronous Database Upserts:**
- Problem: Time entries are upserted one-by-one in a loop
- Files: `/Users/vmiller/projects/time-tracker/backend/src/server.ts` (lines 69-96), `/Users/vmiller/projects/time-tracker/backend/src/services/toggl.service.ts` (lines 102-127), `/Users/vmiller/projects/time-tracker/backend/src/services/tempo.service.ts` (lines 92-131)
- Cause: Using sequential `await` in loop instead of batch operations
- Improvement path: Use `prisma.createMany()` or `Promise.all()` for parallel upserts, or batch upserts

**Chart Rendering with Large Datasets:**
- Problem: Frontend generates all days in interval for chart (line 188), can "explode browser" per comment
- Files: `/Users/vmiller/projects/time-tracker/frontend/src/App.tsx` (lines 182-204)
- Cause: `eachDayOfInterval()` generates array of all days - could be thousands for "ALL" preset
- Improvement path: Implement virtualization or pagination for large date ranges, limit chart to max visible days

**No Pagination on Stats Endpoint:**
- Problem: `/api/stats` endpoint returns all entries from database without pagination
- Files: `/Users/vmiller/projects/time-tracker/backend/src/server.ts` (lines 21-28)
- Cause: Simple `findMany()` with no limit
- Improvement path: Add pagination parameters (offset/limit) or cursor-based pagination for scalability

**File Parsing in Memory:**
- Problem: CSV upload loads entire file into memory as string before parsing
- Files: `/Users/vmiller/projects/time-tracker/backend/src/server.ts` (line 39)
- Cause: `toBuffer()` then `toString()` loads full file
- Improvement path: For MVP with small CSVs this is fine, but for larger files use streaming parser

## Fragile Areas

**CSV Format Detection:**
- Files: `/Users/vmiller/projects/time-tracker/backend/src/server.ts` (lines 40-59)
- Why fragile: Relies on filename heuristics ("toggl") and content sniffing ("Issue,Key") to determine format
- Safe modification: If changing CSV adapters, ensure detection logic is updated and tested with real export files
- Test coverage: No automated tests for format detection logic

**Date Range Calculation:**
- Files: `/Users/vmiller/projects/time-tracker/frontend/src/App.tsx` (lines 48-61, 154-167)
- Why fragile: Complex date manipulation logic with many presets and edge cases (TODAY, WEEK, MONTH, etc.)
- Safe modification: Any changes to preset logic should verify all preset types and navigation (prev/next)
- Test coverage: No automated tests for date range logic

**Tempo API Response Parsing:**
- Files: `/Users/vmiller/projects/time-tracker/backend/src/services/tempo.service.ts` (lines 93-107)
- Why fragile: Fallback logic for missing issue keys relies on undocumented API structure
- Safe modification: Tempo API response structure changes could break parsing - add defensive checks
- Test coverage: No automated tests, only console.log debug output

**Chart Bar Click Handler:**
- Files: `/Users/vmiller/projects/time-tracker/frontend/src/App.tsx` (lines 254-259)
- Why fragile: Attempts multiple paths to extract clicked date from chart event object
- Safe modification: Recharts API changes could break click detection - relies on internal event structure
- Test coverage: No automated tests

## Scaling Limits

**SQLite Database:**
- Current capacity: Single file database (116KB), appropriate for single user
- Limit: SQLite not suitable for concurrent writes or multi-user scenarios
- Scaling path: Migrate to PostgreSQL or MySQL for production multi-user deployment

**In-Memory State Management:**
- Current capacity: All entries loaded into React state on component mount
- Limit: Browser memory constraints with thousands of entries (estimated ~10,000 entries before performance degrades)
- Scaling path: Implement server-side filtering, pagination, and virtual scrolling

**Cache File Approach:**
- Current capacity: 10-minute cache stored as JSON files on disk
- Limit: File system I/O becomes bottleneck with multiple concurrent syncs, no cache invalidation strategy
- Scaling path: Use Redis or in-memory cache with proper TTL and invalidation

**API Pagination Limits:**
- Current capacity: Toggl and Tempo APIs queried with hardcoded limit=1000
- Limit: More than 1000 entries in 3-month window will be truncated
- Scaling path: Implement pagination loop to fetch all results from external APIs

## Dependencies at Risk

**date-fns Version Mismatch:**
- Risk: Frontend uses `date-fns@4.1.0`, backend uses `date-fns@3.6.0`
- Impact: Potential inconsistencies in date handling between frontend and backend
- Migration plan: Standardize on single version (latest 4.x) across both packages

**React 19 (Bleeding Edge):**
- Risk: Frontend uses `react@19.2.0` which is very recent
- Impact: Limited ecosystem support, potential breaking changes, fewer resources for troubleshooting
- Migration plan: Consider staying on React 18 LTS for stability or accept cutting-edge risks

**Axios Version:**
- Risk: Both packages use `axios@1.13.2` but latest is 1.7.x+
- Impact: Missing security patches and bug fixes
- Migration plan: Update to latest stable 1.x version

## Missing Critical Features

**Error Logging and Monitoring:**
- Problem: No structured error logging or monitoring system
- Blocks: Debugging production issues, understanding user errors, API failure tracking
- Impact: High - cannot diagnose issues in production

**Testing Infrastructure:**
- Problem: Zero test files in source code (only dependency tests in node_modules)
- Blocks: Safe refactoring, regression prevention, CI/CD pipeline
- Impact: High - changes are risky without test coverage

**Data Export:**
- Problem: No way to export aggregated data back to CSV or other formats
- Blocks: Reporting, backup, data portability
- Impact: Medium - users can only view data, not export it

**Multi-User Support:**
- Problem: No user authentication or data isolation
- Blocks: Team usage, SaaS deployment
- Impact: High - currently single-user only

**Backup/Restore:**
- Problem: No mechanism to backup or restore database
- Blocks: Data recovery after corruption or accidental deletion
- Impact: High - data loss risk

## Test Coverage Gaps

**No Unit Tests:**
- What's not tested: All business logic, data transformations, parsing logic
- Files: All `.ts` and `.tsx` files in `/Users/vmiller/projects/time-tracker/backend/src/` and `/Users/vmiller/projects/time-tracker/frontend/src/`
- Risk: Refactoring or changes can silently break functionality
- Priority: High

**No Integration Tests:**
- What's not tested: API endpoints, database operations, CSV import flow
- Files: `/Users/vmiller/projects/time-tracker/backend/src/server.ts`, all service files
- Risk: Breaking changes to API contracts, database schema migrations could fail in production
- Priority: High

**No E2E Tests:**
- What's not tested: Complete user workflows (sync, filter, edit, delete)
- Files: Entire frontend application
- Risk: UI regressions, broken user flows undetected until manual testing
- Priority: Medium

**No External API Mocking:**
- What's not tested: Toggl/Tempo API integration behavior under failure conditions
- Files: `/Users/vmiller/projects/time-tracker/backend/src/services/toggl.service.ts`, `/Users/vmiller/projects/time-tracker/backend/src/services/tempo.service.ts`
- Risk: Cannot test error handling for API failures, rate limits, or schema changes
- Priority: Medium

---

*Concerns audit: 2026-01-19*
