# Roadmap: Time Tracker Dashboard

## Milestones

- **v1.0 MVP** — Phases 1-6 (shipped 2026-02-06) — [Archive](milestones/v1.0-ROADMAP.md)
- **v2.0 Utility Tracking** — Phases 7-10 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-6) — SHIPPED 2026-02-06</summary>

- [x] Phase 1: Authentication & Security (4/4 plans) — completed 2026-01-21
- [x] Phase 2: Containerization & Deployment (4/4 plans) — completed 2026-01-21
- [x] Phase 3: Data Quality & PostgreSQL Migration (4/4 plans) — completed 2026-01-21
- [x] Phase 4: UX Enhancements (4/4 plans) — completed 2026-01-22
- [x] Phase 5: Manual Entry & Provider Abstraction (pre-existing) — completed 2026-01-29
- [x] Phase 6: CLI Tool (pre-existing) — completed 2026-01-29

</details>

## v2.0 Utility Tracking (Phases 7-10)

**Milestone Goal:** Add utility meter tracking (electricity, gas, hot water) with manual entry, Excel import, year-over-year visualization, and advanced analytics — as a new section alongside time tracking.

### Phase 7: Foundation

**Goal:** Users can store and manage utility meter readings with automatic consumption calculation.

**Depends on:** Nothing (first phase of v2.0)

**Requirements:** DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, NAV-01, NAV-02, NAV-03

**Success Criteria** (what must be TRUE):
1. User can create a meter (Strom/Gas/Wasser Warm) with name and unit
2. User can view, edit, and delete meter readings
3. App automatically calculates monthly consumption from consecutive readings
4. App validates readings are monotonically increasing (rejects invalid data)
5. User can navigate to Utilities section from main navigation
6. Utilities section shares authentication and theme with time tracking

**Plans:** TBD

Plans:
- [ ] 07-01: TBD during phase planning

### Phase 8: Manual Entry & Basic Visualization

**Goal:** Users can manually enter meter readings and view consumption trends with year-over-year comparisons.

**Depends on:** Phase 7

**Requirements:** INPUT-01, VIS-01, VIS-02, VIS-07

**Success Criteria** (what must be TRUE):
1. User can manually enter a meter reading via form (meter type, date, value)
2. User can view year-over-year bar chart with selectable comparison ranges (2/3/5 years)
3. User can view consumption trend lines over time
4. User can switch between meter types (Strom/Gas/Wasser) on all charts

**Plans:** TBD

Plans:
- [ ] 08-01: TBD during phase planning

### Phase 9: Excel Import

**Goal:** Users can import historical meter readings from Excel files with data validation.

**Depends on:** Phase 7

**Requirements:** INPUT-02, INPUT-03, INPUT-04

**Success Criteria** (what must be TRUE):
1. User can import historical readings from Excel (.xlsx) file
2. Excel import shows preview of parsed data before saving
3. Excel import handles German date formats (DD.MM.YYYY) and ISO dates
4. Import validates data integrity and shows errors for invalid readings

**Plans:** TBD

Plans:
- [ ] 09-01: TBD during phase planning

### Phase 10: Advanced Visualization

**Goal:** Users can view advanced analytics including cumulative tracking, anomaly detection, seasonal patterns, and forecasting.

**Depends on:** Phase 7, Phase 9 (requires historical data)

**Requirements:** VIS-03, VIS-04, VIS-05, VIS-06

**Success Criteria** (what must be TRUE):
1. User can view cumulative yearly tracker (running total by year, overlaid)
2. User can see months flagged where consumption deviates significantly from historical average
3. User can view seasonal heatmap (months × years, color-coded by intensity)
4. User can view forecast projection for remaining months of current year
5. All advanced visualizations work with multi-year imported data

**Plans:** TBD

Plans:
- [ ] 10-01: TBD during phase planning

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Authentication & Security | v1.0 | 4/4 | Complete | 2026-01-21 |
| 2. Containerization & Deployment | v1.0 | 4/4 | Complete | 2026-01-21 |
| 3. Data Quality & PostgreSQL Migration | v1.0 | 4/4 | Complete | 2026-01-21 |
| 4. UX Enhancements | v1.0 | 4/4 | Complete | 2026-01-22 |
| 5. Manual Entry & Provider Abstraction | v1.0 | Pre-existing | Complete | 2026-01-29 |
| 6. CLI Tool | v1.0 | Pre-existing | Complete | 2026-01-29 |
| 7. Foundation | v2.0 | 0/? | Not started | - |
| 8. Manual Entry & Basic Visualization | v2.0 | 0/? | Not started | - |
| 9. Excel Import | v2.0 | 0/? | Not started | - |
| 10. Advanced Visualization | v2.0 | 0/? | Not started | - |
