import { useState, useEffect } from 'react';
import { getTheme, setTheme as persistTheme, getEffectiveTheme, type Theme, type EffectiveTheme } from '../lib/theme';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getTheme());
  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>(getEffectiveTheme());

  useEffect(() => {
    const effective = getEffectiveTheme();
    setEffectiveTheme(effective);

    // Apply or remove dark class on documentElement
    if (effective === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Listen to system preference changes when theme is 'system'
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      const handleChange = (e: MediaQueryListEvent) => {
        const newEffective = e.matches ? 'dark' : 'light';
        setEffectiveTheme(newEffective);

        if (newEffective === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    persistTheme(newTheme);
  };

  return {
    theme,
    setTheme,
    effectiveTheme,
  };
}
