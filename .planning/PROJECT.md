# Time Tracker Dashboard

## What This Is

A production-ready, full-stack time tracking aggregator that consolidates hours from multiple sources (Toggl, Tempo, manual entry) into a unified dashboard with JWT authentication, Docker deployment, dark mode, CSV/PDF export, and a Go CLI for terminal access.

## Why It Exists

Tracking time across multiple systems (Toggl for general work, Tempo for Jira-linked tasks) makes it hard to see total daily hours. This dashboard provides a single source of truth for worked hours across all sources.

## Core Value

**See all worked hours in one place** — regardless of which system tracked them.

## Current State

**Version:** v1.0.1 (shipped 2026-02-06)
**Tech Stack:** React + Vite + TypeScript (frontend), Fastify + TypeScript (backend), PostgreSQL + Prisma (database), Go + Cobra (CLI), Docker Compose (deployment)
**Codebase:** ~7,400 LOC across 204 files

## Requirements

### Validated

- [x] Sync time entries from Toggl API — pre-existing
- [x] Sync time entries from Tempo API — pre-existing
- [x] Import time entries from Toggl CSV — pre-existing
- [x] Import time entries from Tempo CSV — pre-existing
- [x] View daily hours in bar chart — pre-existing
- [x] Filter entries by date range (presets + custom) — pre-existing
- [x] Edit time entries — pre-existing
- [x] Delete time entries — pre-existing
- [x] View entries by source (Toggl/Tempo/All) — pre-existing
- [x] User can log in with credentials (single user) — v1.0
- [x] Application runs in Docker containers — v1.0
- [x] Docker Compose orchestrates frontend, backend, database — v1.0
- [x] Tempo API resolves internal IDs to readable issue keys — v1.0
- [x] PostgreSQL replaces SQLite for production — v1.0
- [x] User can switch between light and dark themes — v1.0
- [x] User can export filtered data as CSV — v1.0
- [x] User can export filtered data as PDF — v1.0
- [x] Synthetic ID generation handles edge cases robustly — v1.0
- [x] User can add manual time entries directly — v1.0
- [x] Go CLI shows today's worked hours — v1.0
- [x] Go CLI shows weekly summary — v1.0
- [x] Go CLI triggers sync via backend API — v1.0
- [x] Clean provider abstraction for adding new sources — v1.0

### Active

- [ ] Clockify API integration
- [ ] Project estimation tracking with enhanced project names

### Out of Scope

- Multi-user authentication — v1 is single user, architecture supports expansion
- Mobile app — web-first approach, responsive design sufficient
- Real-time sync — manual trigger is sufficient
- Billing/invoicing features — export covers this need
- Time tracking in CLI — CLI is read-only + sync trigger
- Offline mode — requires PWA/service workers

## Constraints

- **Hosting:** Hetzner server (Docker deployment)
- **Auth:** Single user for v1, but architecture supports multi-user
- **CLI:** Go language, queries backend API (not direct to external APIs)
- **Extensibility:** New time sources require implementing TimeProvider interface

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single user auth first | Faster to deployment, simpler security | Good — shipped quickly, works well |
| Go for CLI | Developer familiarity, single binary distribution | Good — clean CLI with cobra |
| CLI via backend API | Single source of truth, no duplicate API logic | Good — no sync divergence |
| Docker Compose | Simplifies multi-container deployment | Good — reliable deployment on Hetzner |
| node:22-slim for backend | bcrypt native binding compatibility | Good — resolved Alpine build issues |
| Puppeteer for PDF | Server-side generation, better quality | Good — professional output |
| PostgreSQL gen_random_uuid() | Database-level UUID, no app-level collisions | Good — eliminates race conditions |
| Tailwind darkMode: 'selector' | Class-based theming, explicit control | Good — no FOUC with inline script |
| react-select for dropdowns | Consistent styling, keyboard navigation | Good — unified UI feel |
| Provider abstraction pattern | Extensible architecture for new sources | Good — adding sources is straightforward |
| Custom toast over library | Zero dependencies, full control with Tailwind | Good — lightweight, matches app styling |
| ThemeProvider context | Shared state across all theme consumers | Good — fixed react-select not updating on toggle |

## Stakeholders

- **Owner:** You (sole developer and user)
- **Future:** Potential multi-user expansion

## Success Looks Like

1. Dashboard accessible from anywhere via Hetzner server
2. All worked hours visible in one view
3. Can check hours from terminal without opening browser
4. Adding a new time source takes < 1 day of work

---
*Last updated: 2026-02-06 after v1.0.1 release*
