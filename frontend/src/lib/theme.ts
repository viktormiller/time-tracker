// Theme preference utilities
// Uses localStorage for persistence, system preference as default

const THEME_KEY = 'user_theme_preference';

export type Theme = 'light' | 'dark' | 'system';
export type EffectiveTheme = 'light' | 'dark';

/**
 * Get the user's theme preference.
 * Returns stored preference or 'system' if none.
 */
export function getTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'system';
  }

  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }

  return 'system';
}

/**
 * Set the user's theme preference.
 * If 'system', removes the preference to defer to system default.
 */
export function setTheme(theme: Theme): void {
  if (theme === 'system') {
    localStorage.removeItem(THEME_KEY);
  } else {
    localStorage.setItem(THEME_KEY, theme);
  }
}

/**
 * Get the effective theme (actual 'light' or 'dark').
 * Resolves 'system' preference to actual theme based on prefers-color-scheme.
 */
export function getEffectiveTheme(): EffectiveTheme {
  const theme = getTheme();

  if (theme === 'system') {
    if (typeof window === 'undefined') {
      return 'light';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return theme;
}

/**
 * Get system's preferred color scheme (ignoring user preference).
 */
export function getSystemTheme(): EffectiveTheme {
  if (typeof window === 'undefined') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
