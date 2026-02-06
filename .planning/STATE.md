# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-06)

**Core value:** See all important numbers in one place — worked hours and utility consumption, regardless of source.
**Current focus:** v2.0 Utility Tracking - Phase 7 Foundation

## Current Position

Phase: 7 of 10 (Foundation)
Plan: 3 of 4
Status: In progress
Last activity: 2026-02-06 — Completed 07-03-PLAN.md (Backend API Routes)

Progress: [███████████████░░░░░] 75% (Phase 7: 3/4 plans)

## Performance Metrics

**v1.0 MVP:**
- Total plans completed: 16
- Total phases: 6
- Timeline: 56 days (Dec 5, 2025 → Jan 29, 2026)
- Commits: 160

**Quick Tasks:**
- Completed: 1 (quick-001: toast notifications)
- Additional fixes: dark mode dropdown reactivity, v1.0.1 version bump
- Commits: 6

**v2.0 Progress:**
- Total phases: 4 (phases 7-10)
- Total plans: 4+ (Phase 7 has 4 plans, others TBD)
- Completed: 3 (07-01: Database schema, 07-02: Frontend shell, 07-03: Backend API)
- In progress: Phase 7 (3/4 plans complete)

## Accumulated Context

### Decisions

All v1.0 decisions logged in PROJECT.md Key Decisions table with outcomes.

**v2.0 architectural decisions:**
- **Parallel domain separation**: Utility tracking shares infrastructure (auth, theme, navigation, database) while maintaining clean separation from time tracking business logic
- **Filesystem image storage**: Meter photos stored at /uploads/meter-photos/ with Docker volume, NOT in database (prevents bloat per PostgreSQL wiki guidance)
- **Consumption calculation**: Delta calculations performed on-demand, not stored, for data integrity
- **Monotonic validation**: Database constraints enforce readings must increase (prevents physically impossible data)

**Phase 7 Plan 01 decisions:**
- **Application-level enum for meter type**: Use String in Prisma with Zod enum validation instead of PostgreSQL enum for flexibility (matches TimeEntry.source pattern)
- **Date-only storage**: Use @db.Date for readings since they're taken once per day (no time precision needed)
- **Database-level trigger**: Implement monotonic validation via PostgreSQL trigger for integrity even with multiple clients

**Phase 7 Plan 02 decisions:**
- **Navigation placement**: Utilities button placed before Estimates in header (left-to-right priority)
- **Helper function pattern**: Extract getNavButtonClass to avoid TypeScript control flow narrowing when checking currentView after early returns
- **Active state consistency**: Apply same indigo highlight pattern to Utilities and Estimates buttons for uniform UX
- **Interface export**: Export MeterReading interface to satisfy TypeScript noUnusedLocals while preparing for Plan 04 use

**Phase 7 Plan 03 decisions:**
- **Application-level monotonic validation**: Primary validation in route handlers with user-friendly errors; database trigger as safety net backup
- **@fastify/static version 7**: Use v7 (not v8) for Fastify 4.x compatibility (v8 requires Fastify 5.x)
- **Uploads in protected scope**: Register @fastify/static within utilityRoutes to ensure photos require JWT authentication

### Pending Todos

None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 001 | Replace all browser alerts with toast notifications | 2026-02-06 | e5520d7 | [001-replace-alerts-with-toast-notifications](./quick/001-replace-alerts-with-toast-notifications/) |

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-06T10:16:26Z (Phase 7 Plan 03 execution)
Stopped at: Completed 07-03-PLAN.md (Backend API routes with CRUD, monotonic validation, photo upload)
Resume file: None
Next: Execute 07-04-PLAN.md (Frontend CRUD implementation)
