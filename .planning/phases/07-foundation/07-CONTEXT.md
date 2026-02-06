# Phase 7: Foundation - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can store and manage utility meter readings (electricity, gas, hot water) with automatic consumption calculation and validation. This phase delivers the core data model, CRUD operations for meters and readings, and navigation integration. Manual entry forms, Excel import, and advanced visualization are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Meter setup & management
- Required fields: meter type (Strom/Gas/Wasser Warm), custom name, unit (kWh, m³), location
- Support unlimited meters per type (multiple electricity meters, multiple gas meters, etc.)
- Action menu (kebab/...) for edit and delete operations
- Soft delete meters: mark as archived/deleted but preserve data and readings

### Reading entry & display
- Table view with sortable columns
- Detailed info per reading: date, meter value, consumption (with unit), meter name, meter type, location
- "Add Reading" button opens modal form with meter selection, date picker, value input
- Actions per reading: edit, delete, attach photo (filesystem storage at /uploads/meter-photos/)

### Consumption calculation & validation
- Calculate deltas on-demand at display time (not stored)
- First reading shows "Baseline" or "-" for consumption (no previous reading to compare)
- Monotonic validation: inline form error when user tries to save decreasing value
- Error message: user-friendly tone — "This reading is lower than your last one. Meter values can only increase."

### Navigation & section structure
- Utilities appears after time tracking in main nav: Dashboard | Time Tracking | Utilities
- Empty state: illustration + "Track your utility meters" + "Create First Meter" CTA button
- Landing page (with meters): tabbed by meter type (Strom | Gas | Wasser Warm), content shows readings
- Fully integrated: same session, same theme, same navigation bar — feels like one unified app

### Claude's Discretion
- Exact table styling and spacing
- Loading states and skeleton screens
- Photo upload UI implementation details
- Soft delete implementation approach (archive flag vs separate table)

</decisions>

<specifics>
## Specific Ideas

- Follows PROJECT.md architectural decisions:
  - Filesystem image storage at /uploads/meter-photos/ (not database)
  - Consumption calculated on-demand (not stored)
  - Monotonic validation enforced at database level
  - Parallel domain separation (shares infrastructure, clean separation of business logic)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-foundation*
*Context gathered: 2026-02-06*
