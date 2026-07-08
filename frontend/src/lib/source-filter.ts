const EXCLUDED_SOURCES_KEY = 'user_source_filter_excluded';
const LEGACY_INCLUDE_KEY = 'user_source_filter';
const KNOWN_SOURCES = ['TOGGL', 'TEMPO', 'CLOCKIFY', 'MANUAL'];

function parseSources(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((s): s is string => typeof s === 'string' && KNOWN_SOURCES.includes(s));
  } catch {
    return null;
  }
}

// The filter stores which sources are HIDDEN; empty = everything visible.
export function getExcludedSources(): string[] {
  if (typeof window === 'undefined') return [];

  const excluded = parseSources(localStorage.getItem(EXCLUDED_SOURCES_KEY));
  if (excluded !== null) return excluded;

  // Migrate the legacy include-list (empty = all visible) to exclusions
  const included = parseSources(localStorage.getItem(LEGACY_INCLUDE_KEY));
  if (included !== null && included.length > 0) {
    const migrated = KNOWN_SOURCES.filter(s => !included.includes(s));
    setExcludedSources(migrated);
    localStorage.removeItem(LEGACY_INCLUDE_KEY);
    return migrated;
  }
  return [];
}

export function setExcludedSources(sources: string[]): void {
  localStorage.setItem(EXCLUDED_SOURCES_KEY, JSON.stringify(sources));
}
