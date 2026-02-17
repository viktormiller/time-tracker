import { useState, useEffect, useContext, createContext, type ReactNode } from 'react';
import { getTheme, setTheme as persistTheme, getEffectiveTheme, type Theme, type EffectiveTheme } from '../lib/theme';

function updateThemeColorMeta(effective: EffectiveTheme) {
  const color = effective === 'dark' ? '#111827' : '#f9fafb';
  let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', color);
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  effectiveTheme: EffectiveTheme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getTheme());
  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>(getEffectiveTheme());

  useEffect(() => {
    const effective = getEffectiveTheme();
    setEffectiveTheme(effective);

    if (effective === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Update theme-color meta tag for iOS Safari chrome
    updateThemeColorMeta(effective);

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
        updateThemeColorMeta(newEffective);
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    persistTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, effectiveTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
