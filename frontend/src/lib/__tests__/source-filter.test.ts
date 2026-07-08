import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getExcludedSources, setExcludedSources } from '../source-filter';

const EXCLUDED_KEY = 'user_source_filter_excluded';
const LEGACY_KEY = 'user_source_filter';

describe('Source Filter (exclusion semantics)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('returns no exclusions when nothing is stored', () => {
    expect(getExcludedSources()).toEqual([]);
  });

  it('round-trips excluded sources', () => {
    setExcludedSources(['CLOCKIFY']);
    expect(getExcludedSources()).toEqual(['CLOCKIFY']);
  });

  it('drops unknown sources from stored value', () => {
    localStorage.setItem(EXCLUDED_KEY, JSON.stringify(['CLOCKIFY', 'BOGUS', 42]));
    expect(getExcludedSources()).toEqual(['CLOCKIFY']);
  });

  it('returns no exclusions for invalid JSON', () => {
    localStorage.setItem(EXCLUDED_KEY, 'not-json');
    expect(getExcludedSources()).toEqual([]);
  });

  describe('legacy include-list migration', () => {
    it('converts a legacy include-list to exclusions and removes the old key', () => {
      localStorage.setItem(LEGACY_KEY, JSON.stringify(['TOGGL', 'TEMPO']));

      expect(getExcludedSources()).toEqual(['CLOCKIFY', 'MANUAL']);
      expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
      // Persisted, so the next read no longer depends on the legacy key
      expect(JSON.parse(localStorage.getItem(EXCLUDED_KEY)!)).toEqual(['CLOCKIFY', 'MANUAL']);
    });

    it('treats a legacy empty list (= all visible) as no exclusions', () => {
      localStorage.setItem(LEGACY_KEY, JSON.stringify([]));
      expect(getExcludedSources()).toEqual([]);
    });

    it('prefers the new key over a lingering legacy value', () => {
      localStorage.setItem(EXCLUDED_KEY, JSON.stringify(['MANUAL']));
      localStorage.setItem(LEGACY_KEY, JSON.stringify(['TOGGL']));
      expect(getExcludedSources()).toEqual(['MANUAL']);
    });
  });
});
