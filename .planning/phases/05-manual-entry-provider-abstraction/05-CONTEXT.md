# Phase 5: Manual Entry & Provider Abstraction - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers two capabilities:
1. Users can create time entries directly in the application (without importing/syncing from external sources)
2. The system architecture is refactored to support extensible time tracking providers

The scope includes manual entry creation form, provider abstraction layer, and settings UI for provider management. Future provider implementations (like Clockify) belong in later phases.

</domain>

<decisions>
## Implementation Decisions

### Entry creation form
- **Time input:** Start/end time format (e.g., '09:00 - 11:30') - user enters when they started and finished, system calculates duration
- **Required fields:** Minimal - only date, start time, end time are required; description and project are optional
- **Project field:** Autocomplete with free text fallback - suggests existing projects as user types, but allows entering new project names
- **Form location:** Dedicated 'Add' page/view - separate view for creating entries, keeps dashboard clean

### Manual entry behavior
- **Editability:** Fully editable - all fields (date, time, description, project) can be modified after creation
- **UI distinction:** Different source label - source column shows 'Manual' instead of 'Toggl' or 'Tempo'
- **Conflict handling:** Allow overlaps - manual entries can overlap with synced entries (user might track billable vs non-billable time)
- **Sync interaction:** Never touched by sync - sync operations only affect Toggl/Tempo entries, manual entries are completely separate

### Provider abstraction design
- **Configuration:** UI configuration panel - settings page where users can enable/disable providers and configure API keys
- **Sync triggering:** Both manual and automatic - scheduled background sync runs automatically + manual 'Sync' button for immediate refresh
- **Settings panel:** Full provider status dashboard - shows enabled state, credentials, last sync time, sync errors, and entry counts per provider
- **Provider-specific features:** Provider-specific extensions - base interface for common fields + providers can extend with additional fields (preserves Jira issue keys, tags, etc.)

### Data model consistency
- **Manual entry identification:** New 'source' enum value - add 'MANUAL' to existing source enum (TOGGL, TEMPO) for explicit type-safe identification
- **Project structure:** Single project string field - keep current simple string (Toggl uses project name, Tempo uses 'KEY-123 - Name', manual uses free text)
- **Date/time granularity:** Convert to midnight for date-only - date-only entries (like Tempo) stored as midnight (00:00) for uniform data model
- **Duplicate detection:** No duplicate detection - allow any duplicates, user might intentionally track same time differently

### Claude's Discretion
- Exact form validation messages and error handling
- Automatic sync interval (background scheduling frequency)
- Provider status dashboard layout and visual design
- Migration strategy for existing entries to new provider abstraction

</decisions>

<specifics>
## Specific Ideas

- Form should feel fast - dedicated page means user can focus on entry creation without distraction
- Provider settings should be transparent - user should always know what's enabled, when it last synced, and if there are errors
- Keep the project field flexible - autocomplete helps consistency but don't force users into rigid structure

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-manual-entry-provider-abstraction*
*Context gathered: 2026-01-22*
