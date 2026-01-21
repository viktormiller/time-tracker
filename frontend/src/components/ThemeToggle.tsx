import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export function ThemeToggle() {
  const { effectiveTheme, setTheme } = useTheme();

  const toggleTheme = () => {
    // Toggle between explicit 'light' and 'dark' (not 'system')
    setTheme(effectiveTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
      aria-label={effectiveTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={effectiveTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {effectiveTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
