# Phase 4: UX Enhancements - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Customizable theme system (light/dark mode) with theme persistence, plus data export capabilities (CSV and PDF with chart visualization). This phase focuses on visual customization and data portability.

</domain>

<decisions>
## Implementation Decisions

### Theme toggle placement and behavior
- Toggle appears in top-right corner of header (always visible)
- Icon button style: sun/moon icon that changes based on current theme
- Instant theme switch with no transition effects
- Theme preference stored in localStorage only (frontend-only, no backend changes)

### Dark mode visual design
- Soft dark palette: dark gray background (~#1a1a1a), not true black
- Accent colors (links, buttons, highlights) adjust for dark mode - lighter/more vibrant for better contrast
- Chart visualization inverts colors in dark mode (dark background, light grid, adjusted bars)
- Auto-detect OS theme preference on first load (prefers-color-scheme media query)

### Claude's Discretion
- Export button placement and UI design (discussed areas not selected)
- CSV vs PDF content structure and formatting (discussed areas not selected)
- Specific color values for dark mode palette (as long as soft dark ~#1a1a1a approach is followed)
- Exact accent color adjustments (ensure accessibility)
- Chart color palette in dark mode (ensure readability)

</decisions>

<specifics>
## Specific Ideas

- Theme persistence follows same pattern as timezone selector (localStorage, auto-detect on first load)
- Top-right header placement matches common patterns like GitHub, Twitter
- Soft dark approach common in developer tools for reduced eye strain

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-ux-enhancements*
*Context gathered: 2026-01-21*
