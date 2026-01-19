# Roadmap: Time Tracker Dashboard

## Overview

This roadmap transforms a working time tracking aggregator into a production-ready, deployable system. Starting with authentication security, moving through containerization and deployment infrastructure, then enhancing data quality and user experience, finally adding CLI access and extensibility for future time sources. Each phase builds on the previous, delivering incremental value while maintaining the core functionality that already works.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Authentication & Security** - Single-user login with JWT protection
- [ ] **Phase 2: Containerization & Deployment** - Docker infrastructure for production deployment
- [ ] **Phase 3: Data Quality & PostgreSQL Migration** - Production database with robust ID handling
- [ ] **Phase 4: UX Enhancements** - Dark mode and export capabilities
- [ ] **Phase 5: Manual Entry & Provider Abstraction** - Direct entry creation and extensible architecture
- [ ] **Phase 6: CLI Tool** - Command-line access for quick time checks
- [ ] **Phase 7: Future Sources** - Clockify integration and provider pattern

## Phase Details

### Phase 1: Authentication & Security
**Goal**: User can securely access the dashboard with credentials
**Depends on**: Nothing (first phase)
**Requirements**: REQ-001
**Success Criteria** (what must be TRUE):
  1. User can log in with username and password
  2. User remains logged in across browser sessions
  3. User can log out from any page
  4. All API routes require valid authentication
  5. Unauthenticated requests are rejected with 401
**Plans**: 4 plans

Plans:
- [ ] 01-01-PLAN.md — Backend auth infrastructure (JWT, sessions, security)
- [ ] 01-02-PLAN.md — Auth routes and middleware (login, logout, refresh)
- [ ] 01-03-PLAN.md — Protect API routes and frontend integration
- [ ] 01-04-PLAN.md — Verify complete authentication flow

### Phase 2: Containerization & Deployment
**Goal**: Application runs in production-ready Docker containers on Hetzner
**Depends on**: Phase 1
**Requirements**: REQ-002, REQ-003
**Success Criteria** (what must be TRUE):
  1. Frontend, backend, and database run in separate containers
  2. Services start in correct order with health checks
  3. `docker-compose up` launches entire stack
  4. Secrets managed via Docker Secrets (not environment variables)
  5. Only ports 80/443 exposed to public (database internal only)
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

### Phase 3: Data Quality & PostgreSQL Migration
**Goal**: Production database with timezone support and robust synthetic IDs
**Depends on**: Phase 2
**Requirements**: REQ-005, REQ-009, REQ-004
**Success Criteria** (what must be TRUE):
  1. PostgreSQL replaces SQLite in production environment
  2. Existing SQLite data migrated successfully to PostgreSQL
  3. DateTime fields preserve timezone information (TIMESTAMPTZ)
  4. Concurrent sync operations don't cause duplicate ID conflicts
  5. Tempo entries display readable Jira issue keys (e.g., ABC-27)
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: UX Enhancements
**Goal**: Users can customize theme and export their data
**Depends on**: Phase 3
**Requirements**: REQ-006, REQ-007, REQ-008
**Success Criteria** (what must be TRUE):
  1. User can toggle between light and dark themes
  2. Theme preference persists across sessions
  3. User can export filtered entries as CSV file
  4. User can export filtered entries with chart as PDF
  5. All components readable in both light and dark modes
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

### Phase 5: Manual Entry & Provider Abstraction
**Goal**: Users can add entries directly and system is ready for new sources
**Depends on**: Phase 4
**Requirements**: REQ-010, REQ-015
**Success Criteria** (what must be TRUE):
  1. User can add manual time entry via form
  2. User can specify date, duration (or start/end time), description, and project
  3. Manual entries appear immediately in dashboard
  4. Unified Provider interface exists for all time sources
  5. Adding new time source requires implementing single interface
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

### Phase 6: CLI Tool
**Goal**: User can check worked hours from terminal without browser
**Depends on**: Phase 5
**Requirements**: REQ-011, REQ-012, REQ-013
**Success Criteria** (what must be TRUE):
  1. User can run `timetracker today` to see today's hours
  2. User can run `timetracker week` to see weekly breakdown
  3. User can run `timetracker sync` to trigger backend sync
  4. CLI authenticates with backend API using JWT
  5. CLI config stored securely in ~/.timetracker/config.yaml
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

### Phase 7: Future Sources
**Goal**: System supports Clockify and makes adding sources trivial
**Depends on**: Phase 6
**Requirements**: REQ-014, (REQ-015 already in Phase 5)
**Success Criteria** (what must be TRUE):
  1. User can configure Clockify API key in settings
  2. Clockify entries sync automatically with other sources
  3. Clockify entries support same operations as Toggl/Tempo
  4. Documentation exists for adding new time tracking sources
  5. New provider can be added in less than 1 day of work
**Plans**: TBD

Plans:
- [ ] 07-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Authentication & Security | 0/4 | Planning complete | - |
| 2. Containerization & Deployment | 0/? | Not started | - |
| 3. Data Quality & PostgreSQL Migration | 0/? | Not started | - |
| 4. UX Enhancements | 0/? | Not started | - |
| 5. Manual Entry & Provider Abstraction | 0/? | Not started | - |
| 6. CLI Tool | 0/? | Not started | - |
| 7. Future Sources | 0/? | Not started | - |
