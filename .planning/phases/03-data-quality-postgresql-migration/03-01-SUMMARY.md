---
phase: 03-data-quality-postgresql-migration
plan: 01
subsystem: database
tags: [postgresql, prisma, timestamptz, uuid, pgloader, migration]

# Dependency graph
requires:
  - phase: 02-containerization-a-deployment
    provides: Docker Compose setup with PostgreSQL 17 Alpine database
provides:
  - PostgreSQL schema with TIMESTAMPTZ for timezone-aware timestamps
  - Database-level UUID generation with gen_random_uuid()
  - pgloader-based SQLite to PostgreSQL migration script
  - Post-migration validation script
affects: [03-02-tempo-service-enhancement, 03-03-timezone-ui]

# Tech tracking
tech-stack:
  added: []  # pgloader used as CLI tool, not installed as dependency
  patterns:
    - Database-level ID generation with gen_random_uuid()
    - TIMESTAMPTZ(6) for all DateTime fields
    - Maintenance window migration strategy

key-files:
  created:
    - backend/prisma/migrations/20260121033513_add_timestamptz_and_db_uuid/migration.sql
    - backend/scripts/migrate-sqlite-to-pg.sh
    - backend/scripts/validate-migration.ts
  modified:
    - backend/prisma/schema.prisma
    - backend/package.json
    - docker-compose.yml

key-decisions:
  - "Use PostgreSQL native gen_random_uuid() for database-level UUID generation"
  - "Use TIMESTAMPTZ(6) for microsecond precision timezone-aware timestamps"
  - "Expose PostgreSQL port 5432 in development docker-compose for local migrations"
  - "Use pgloader for SQLite to PostgreSQL migration with automatic type conversion"
  - "Validate migration with count checks, null ID detection, and duplicate verification"

patterns-established:
  - "Database-level UUID generation: @default(dbgenerated(\"gen_random_uuid()\")) @db.Uuid"
  - "Timezone-aware timestamps: DateTime @db.Timestamptz(6)"
  - "Migration validation pattern: count verification + sample data + duplicate detection"

# Metrics
duration: 3min
completed: 2026-01-21
---

# Phase 3 Plan 1: Schema Migration Summary

**PostgreSQL schema with TIMESTAMPTZ timezone-aware timestamps and database-level UUID generation via gen_random_uuid()**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-21T03:33:41Z
- **Completed:** 2026-01-21T03:36:41Z (approx)
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Updated Prisma schema to use PostgreSQL-native TIMESTAMPTZ with microsecond precision
- Implemented database-level UUID generation with gen_random_uuid() for collision resistance
- Created pgloader-based migration script for SQLite to PostgreSQL data transfer
- Built comprehensive validation script to verify migration integrity

## Task Commits

Each task was committed atomically:

1. **Task 1: Update Prisma Schema for PostgreSQL Features** - `b7ed11f` (feat)
2. **Task 2: Create SQLite to PostgreSQL Migration Script** - `b89bb1e` (feat)
3. **Task 3: Create Migration Validation Script** - `0461d9a` (feat)

## Files Created/Modified
- `backend/prisma/schema.prisma` - Updated TimeEntry model with UUID and TIMESTAMPTZ
- `backend/prisma/migrations/20260121033513_add_timestamptz_and_db_uuid/migration.sql` - Prisma migration for schema changes
- `backend/scripts/migrate-sqlite-to-pg.sh` - pgloader migration script with validation
- `backend/scripts/validate-migration.ts` - Post-migration validation with integrity checks
- `backend/package.json` - Added validate-migration npm script
- `docker-compose.yml` - Added port mapping 5432:5432 for development database access

## Decisions Made

**PostgreSQL 17 has gen_random_uuid() built-in**
- No need for pgcrypto extension (required only for PostgreSQL 12-13)
- Simplifies migration setup

**Expose database port in development**
- Added `ports: ["5432:5432"]` to docker-compose.yml db service
- Allows running Prisma migrations from host machine during development
- Production deployments keep database internal (no port exposure)

**Validation strategy**
- Count total entries (with optional expected count comparison)
- Check for null IDs using raw SQL query
- Detect duplicate source+externalId combinations
- Sample recent entries to verify data integrity
- Validate UUID format in samples

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed null ID check in validation script**
- **Found during:** Task 3 (Migration validation script)
- **Issue:** Prisma client doesn't support `{ equals: null }` syntax for null checks
- **Fix:** Switched to raw SQL query: `SELECT COUNT(*) FROM "TimeEntry" WHERE id IS NULL`
- **Files modified:** backend/scripts/validate-migration.ts
- **Verification:** Validation script runs successfully against empty PostgreSQL database
- **Committed in:** 0461d9a (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Bug fix necessary for validation script to execute. No scope creep.

## Issues Encountered

**Database port not exposed initially**
- Problem: Attempted to run Prisma migration from host but couldn't reach database
- Resolution: Added port mapping to docker-compose.yml and restarted database service
- Impact: Additional file modification (docker-compose.yml) beyond plan scope

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for data migration:**
- Schema updated with production-ready types
- Migration script ready to transfer SQLite data
- Validation script confirms data integrity

**Ready for Tempo service enhancement:**
- TIMESTAMPTZ fields store timezone information
- UUID IDs provide collision resistance for sync operations
- Database schema supports issue key caching (can be added in next plan)

**Blockers/Concerns:**
- SQLite to PostgreSQL migration script not yet tested with real data (will be tested in plan execution)
- pgloader must be installed on system before running migration (documented in script)

---
*Phase: 03-data-quality-postgresql-migration*
*Completed: 2026-01-21*
