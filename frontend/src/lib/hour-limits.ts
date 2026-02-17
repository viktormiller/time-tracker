// Hour limit preference utilities
// Uses localStorage for persistence, null = disabled

const HOUR_LIMITS_KEY = 'user_hour_limits';

export interface HourLimits {
  dailyLimit: number | null;
  weeklyLimit: number | null;
}

const DEFAULT_LIMITS: HourLimits = {
  dailyLimit: null,
  weeklyLimit: null,
};

/**
 * Get the user's hour limit preferences.
 * Returns stored preferences or defaults (both null/disabled).
 */
export function getHourLimits(): HourLimits {
  if (typeof window === 'undefined') {
    return DEFAULT_LIMITS;
  }

  const stored = localStorage.getItem(HOUR_LIMITS_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return {
        dailyLimit: typeof parsed.dailyLimit === 'number' ? parsed.dailyLimit : null,
        weeklyLimit: typeof parsed.weeklyLimit === 'number' ? parsed.weeklyLimit : null,
      };
    } catch {
      return DEFAULT_LIMITS;
    }
  }

  return DEFAULT_LIMITS;
}

/**
 * Set the user's hour limit preferences.
 * Persists to localStorage.
 */
export function setHourLimits(limits: HourLimits): void {
  localStorage.setItem(HOUR_LIMITS_KEY, JSON.stringify(limits));
}
