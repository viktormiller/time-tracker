---
phase: 07-foundation
plan: 01
subsystem: database
tags: [prisma, postgresql, zod, schema, triggers, validation]

# Dependency graph
requires:
  - phase: 06-wrap-up
    provides: "v1.0 MVP with Prisma, PostgreSQL, time tracking"
provides:
  - "Meter and MeterReading Prisma models with monotonic validation"
  - "Database schema for utility tracking (electricity, gas, water)"
  - "Zod validation schemas for meter and reading API inputs"
affects: [07-02, 07-03, 08-api, 09-ui, 10-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PostgreSQL trigger functions for data integrity constraints"
    - "Zod enum validation for application-level type checking"

key-files:
  created:
    - "backend/src/schemas/utility.schema.ts"
    - "backend/prisma/migrations/20260206095228_add_utility_meters/migration.sql"
    - "backend/prisma/migrations/20260206100527_add_utility_meters/migration.sql"
  modified:
    - "backend/prisma/schema.prisma"

key-decisions:
  - "Use String type for meter type field (application-level enum) to match existing TimeEntry.source pattern"
  - "Store meter reading date as @db.Date (date only, no time) since readings are taken once per day"
  - "Implement monotonic validation at database level via PostgreSQL trigger for data integrity"

patterns-established:
  - "Application-level enums via Zod validation instead of database enums for flexibility"
  - "PostgreSQL trigger functions for complex validation that SQL constraints can't express"
  - "One reading per meter per date enforced at database level via unique constraint"

# Metrics
duration: 2min
completed: 2026-02-06
---

# Phase 7 Plan 01: Foundation Summary

**Prisma models for utility meters with PostgreSQL monotonic validation trigger and Zod schemas**

## Performance

- **Duration:** 2 minutes
- **Started:** 2026-02-06T19:05:10Z
- **Completed:** 2026-02-06T19:07:16Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Meter and MeterReading models established in Prisma schema with soft delete support
- Database-level monotonic validation trigger prevents physically impossible meter readings
- Unique constraint enforces one reading per meter per date
- Zod validation schemas with TypeScript types for all API input operations

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Meter and MeterReading Prisma models with monotonic trigger migration** - `97a8d56` (feat)
2. **Task 2: Create Zod validation schemas for meters and readings** - `d71e88a` (feat)

## Files Created/Modified
- `backend/prisma/schema.prisma` - Added Meter and MeterReading models
- `backend/prisma/migrations/20260206095228_add_utility_meters/migration.sql` - CREATE TABLE statements and monotonic trigger function
- `backend/prisma/migrations/20260206100527_add_utility_meters/migration.sql` - Empty migration applying schema sync
- `backend/src/schemas/utility.schema.ts` - Zod validation schemas for createMeter, updateMeter, createReading, updateReading

## Decisions Made

1. **Application-level enum for meter type**: Used String type in Prisma with Zod enum validation instead of PostgreSQL enum type, matching the existing pattern used for TimeEntry.source. This provides flexibility to add new meter types without database migrations.

2. **Date-only storage for readings**: Used @db.Date instead of timestamp because meter readings are taken once per day and don't need time precision. Simplifies queries and UI logic.

3. **Monotonic validation trigger**: Implemented at database level rather than application level to ensure data integrity even if multiple clients access the database. The trigger checks both previous and future readings to prevent insertion of out-of-order values during edits.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The schema models were already added to the Prisma file from previous exploration, so migration creation and application proceeded smoothly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Database foundation is complete. Ready for:
- Phase 7 Plan 02: API routes for meter CRUD operations
- Phase 7 Plan 03: API routes for reading CRUD operations
- Future phases can now build UI and business logic on top of this schema

**Blockers:** None

**Concerns:** None

---
*Phase: 07-foundation*
*Completed: 2026-02-06*
