# Time Tracker Dashboard

## What This Is

A production-ready, full-stack personal dashboard that consolidates time tracking from multiple sources (Toggl, Tempo, manual entry) and utility meter tracking (electricity, gas, hot water) into a unified interface with JWT authentication, Docker deployment, dark mode, data visualization, and a Go CLI.

## Why It Exists

Tracking time across multiple systems and utility consumption across meters makes it hard to see the big picture. This dashboard provides a single source of truth for worked hours and household utility usage.

## Core Value

**See all important numbers in one place** — worked hours and utility consumption, regardless of source.

## Current Milestone: v2.0 Utility Tracking

**Goal:** Add utility meter tracking (electricity, gas, hot water) with OCR meter reading, dynamic year-over-year charts, and data import — as a new section alongside time tracking.

**Target features:**
- Utility meter reading storage (Strom, Gas, Wasser Warm) with automatic consumption calculation
- OCR from phone photos of digital meter displays (photo → prefill → confirm)
- Manual meter reading input
- Excel import for historical data
- Dynamic year-over-year bar charts with selectable comparison ranges (2/3/5 years)
- Consumption trend lines
- Cumulative yearly tracker (running totals by year)
- Monthly anomaly detection (flag unusual consumption)
- Cost overlay with configurable per-unit rates (€/kWh, €/m³)
- Seasonal heatmap (months × years, color-coded by intensity)
- Forecast projection (predict remaining year based on history)

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

- [ ] Utility meter reading CRUD (Strom, Gas, Wasser Warm)
- [ ] Automatic consumption calculation from meter readings
- [ ] OCR meter reading from phone photos (digital displays)
- [ ] Manual meter reading input
- [ ] Excel import for historical utility data
- [ ] Dynamic year-over-year bar charts with selectable ranges
- [ ] Consumption trend lines
- [ ] Cumulative yearly tracker
- [ ] Monthly anomaly detection
- [ ] Cost overlay with configurable rates
- [ ] Seasonal heatmap visualization
- [ ] Forecast projection for current year

### Out of Scope

- Multi-user authentication — v1 is single user, architecture supports expansion
- Mobile app — web-first approach, responsive design sufficient
- Real-time sync — manual trigger is sufficient
- Billing/invoicing features — export covers this need
- Time tracking in CLI — CLI is read-only + sync trigger
- Offline mode — requires PWA/service workers
- Clockify API integration — deferred from v1, not priority for v2.0
- Project estimation tracking — deferred from v1, not priority for v2.0
- Analog meter dial OCR — only digital displays for v2.0
- Smart meter API integration — manual input + OCR sufficient
- Utility bill PDF parsing — manual entry and Excel import cover this

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
5. Snap a photo of a meter, reading is extracted and saved
6. Monthly utility consumption visible with year-over-year comparison
7. Excel history imported so trends are visible from day one

---
*Last updated: 2026-02-06 after v2.0 milestone start*
