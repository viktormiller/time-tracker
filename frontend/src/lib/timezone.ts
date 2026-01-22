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

/**
 * Format a date string in the user's selected timezone.
 * @param dateString - ISO date string from the backend
 * @param formatStr - date-fns format string (e.g., 'EE dd.MM.yyyy HH:mm')
 * @param locale - date-fns locale object
 */
export function formatInTimezone(
  _dateString: string,
  formatStr: string,
  _locale?: any
): string {
  // This function will be imported where date-fns and date-fns-tz are available
  // It's a simple wrapper that needs to be called from components
  // Actual implementation is in the component using toZonedTime from date-fns-tz
  return formatStr; // Placeholder - actual implementation in component
}
