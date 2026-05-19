const SOURCE_FILTER_KEY = 'user_source_filter';
const KNOWN_SOURCES = ['TOGGL', 'TEMPO', 'CLOCKIFY', 'MANUAL'];

export function getSourceFilter(): string[] {
  if (typeof window === 'undefined') return [];

  const stored = localStorage.getItem(SOURCE_FILTER_KEY);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === 'string' && KNOWN_SOURCES.includes(s));
  } catch {
    return [];
  }
}

export function setSourceFilter(sources: string[]): void {
  localStorage.setItem(SOURCE_FILTER_KEY, JSON.stringify(sources));
}
