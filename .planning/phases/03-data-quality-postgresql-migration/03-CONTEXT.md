# Phase 3: Data Quality & PostgreSQL Migration - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate from SQLite to PostgreSQL with timezone-aware timestamps (TIMESTAMPTZ) and collision-resistant synthetic IDs for production reliability. Ensure existing data is preserved and Tempo entries display readable Jira issue keys.

This phase focuses on database migration and data quality improvements. New data sources or additional features belong in other phases.

</domain>

<decisions>
## Implementation Decisions

### Migration strategy
- Use maintenance window approach: stop app, migrate data, restart with PostgreSQL
- Keep SQLite file as backup (rename to dev.db.backup) after successful migration
- Migration trigger and validation approach: Claude's discretion

### ID collision handling
- Use UUIDs for synthetic IDs (globally unique, collision-resistant)
- Duplicate detection: Strict matching on source + source ID only
- On duplicate collision: Fail the sync operation (don't silently skip or overwrite)
- Error communication: Log and display in UI with details about which entry caused the collision

### Jira issue key display
- Display issue keys in the project column for Tempo entries
- Format: "ABC-27 - Project Name" (issue key first, dash separator, project name)
- Make issue key clickable: Opens Jira issue in new tab (requires Jira base URL configuration)

### Timezone display
- User-configurable timezone preference in settings
- Default timezone: Browser timezone (auto-detected on first load)
- Timestamp format: Relative times for recent entries (e.g., "2 hours ago")
- Switch to absolute dates after 24 hours (e.g., "Jan 20, 2:30 PM")

### Claude's Discretion
- Migration validation approach (count verification vs full field-by-field comparison)
- Migration trigger mechanism (automatic on startup vs manual script)
- Exact error message format for collision failures
- Timezone selector UI implementation
- Relative timestamp update frequency
- Jira base URL configuration location (settings, env var, or both)

</decisions>

<specifics>
## Specific Ideas

No specific requirements beyond the decisions above - open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 03-data-quality-postgresql-migration*
*Context gathered: 2026-01-21*
