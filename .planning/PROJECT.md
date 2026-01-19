# Time Tracker Dashboard

## What This Is

A full-stack time tracking aggregator that consolidates hours from multiple sources (Toggl, Tempo) into a unified dashboard. Built for personal use with a path to multi-user support.

## Why It Exists

Tracking time across multiple systems (Toggl for general work, Tempo for Jira-linked tasks) makes it hard to see total daily hours. This dashboard provides a single source of truth for worked hours across all sources.

## Core Value

**See all worked hours in one place** — regardless of which system tracked them.

## Requirements

### Validated

- [x] Sync time entries from Toggl API — existing
- [x] Sync time entries from Tempo API — existing
- [x] Import time entries from Toggl CSV — existing
- [x] Import time entries from Tempo CSV — existing
- [x] View daily hours in bar chart — existing
- [x] Filter entries by date range (presets + custom) — existing
- [x] Edit time entries — existing
- [x] Delete time entries — existing
- [x] View entries by source (Toggl/Tempo/All) — existing

### Active

**Deployment MVP:**
- [ ] User can log in with credentials (single user initially)
- [ ] Application runs in Docker containers
- [ ] Docker Compose orchestrates frontend, backend, database

**Post-Deployment:**
- [ ] Tempo API resolves internal IDs to readable issue keys (ABC-27 vs "Issue #24990")
- [ ] PostgreSQL replaces SQLite for production
- [ ] User can switch between light and dark themes
- [ ] User can export filtered data as CSV
- [ ] User can export filtered data as PDF
- [ ] Synthetic ID generation handles edge cases robustly
- [ ] User can add manual time entries directly

**CLI Tool:**
- [ ] Go CLI shows today's worked hours
- [ ] Go CLI shows weekly summary
- [ ] Go CLI triggers sync via backend API

**Future Sources:**
- [ ] Clockify API integration
- [ ] Clean provider abstraction for adding new sources

### Out of Scope

- Multi-user authentication (v1 is single user) — future enhancement
- Mobile app — web-first approach
- Real-time sync — manual trigger is sufficient
- Billing/invoicing features — export covers this need

## Constraints

- **Hosting:** Hetzner server (Docker deployment)
- **Auth:** Single user for v1, but architecture should support multi-user
- **CLI:** Go language, queries backend API (not direct to external APIs)
- **Extensibility:** New time sources should be easy to add (provider pattern)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single user auth first | Faster to deployment, simpler security | — Pending |
| Go for CLI | Developer familiarity, single binary distribution | — Pending |
| CLI via backend API | Single source of truth, no duplicate API logic | — Pending |
| Docker Compose | Simplifies multi-container deployment | — Pending |

## Stakeholders

- **Owner:** You (sole developer and user)
- **Future:** Potential multi-user expansion

## Success Looks Like

1. Dashboard accessible from anywhere via Hetzner server
2. All worked hours visible in one view
3. Can check hours from terminal without opening browser
4. Adding a new time source takes < 1 day of work

---
*Last updated: 2026-01-19 after initialization*
