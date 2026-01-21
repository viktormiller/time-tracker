// Timezone preference utilities
// Uses localStorage for persistence, browser timezone as default

const TIMEZONE_KEY = 'user_timezone_preference';

/**
 * Get the user's timezone preference.
 * Returns stored preference or browser's detected timezone.
 */
export function getTimezone(): string {
  if (typeof window === 'undefined') {
    return 'UTC';
  }

  const stored = localStorage.getItem(TIMEZONE_KEY);
  if (stored) {
    return stored;
  }

  // Auto-detect browser timezone
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Set the user's timezone preference.
 * Persists to localStorage.
 */
export function setTimezone(timezone: string): void {
  localStorage.setItem(TIMEZONE_KEY, timezone);
}

/**
 * Clear timezone preference (reverts to browser detection).
 */
export function clearTimezone(): void {
  localStorage.removeItem(TIMEZONE_KEY);
}

/**
 * Get the browser's detected timezone (ignoring preference).
 */
export function getBrowserTimezone(): string {
  if (typeof window === 'undefined') {
    return 'UTC';
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
