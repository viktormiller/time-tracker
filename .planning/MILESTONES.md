# Project Milestones: Time Tracker Dashboard

## v2.1 UX & Security Improvements (Shipped: 2026-03-04)

**Delivered:** Navigation overhaul with collapsible sidebar, login dark mode fix, tighter session security (7-day expiry with warning), and daily/weekly hours comparison badges with instant tooltips.

**Phases completed:** 11-13 (+ 2 additions)

**Key accomplishments:**

- Collapsible sidebar navigation with localStorage persistence and mobile overlay
- Login form dark mode visibility fix
- Session expiry reduced from 30 to 7 days with proactive warning toast
- Daily hours comparison badge (vs same day one month ago, color-coded)
- Weekly hours comparison badge (vs same partial week one month ago)
- Instant CSS tooltips showing comparison date/hours on badge hover

**Commits:** 4e1fbaf, 495f201, 006e6fe, ab153f8

---

## v1.0 MVP (Shipped: 2026-02-06)

**Delivered:** Production-ready time tracking dashboard with JWT auth, Docker deployment, PostgreSQL, dark mode, CSV/PDF export, manual entries, and Go CLI.

**Phases completed:** 1-6 (16 plans total)

**Key accomplishments:**

- Secure JWT authentication with session management, refresh tokens, and CSRF protection
- Production Docker deployment with Compose orchestration, Docker Secrets, and health checks
- PostgreSQL migration with TIMESTAMPTZ, database-level UUIDs, and Jira issue key resolution
- Dark mode with FOUC prevention, CSV export with formula injection sanitization, server-side PDF generation
- Manual time entry with provider abstraction pattern for extensible architecture
- Go CLI tool for terminal-based time checks (today/week) and sync trigger

**Stats:**

- 204 files created/modified
- ~7,400 lines of code (TypeScript, Go, SQL, HTML/CSS)
- 6 phases, 16 plans
- 56 days from first commit to ship (Dec 5, 2025 - Jan 29, 2026)
- 160 commits

**Git range:** Initial commit → `ca2531b`

**What's next:** TBD — next milestone planning

---
