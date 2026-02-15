import { useState, useCallback } from 'react';

type Theme = 'light' | 'dark';

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('jeeves-theme');
    return (saved === 'dark' ? 'dark' : 'light') as Theme;
  });

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('jeeves-theme', next);
      return next;
    });
  }, []);

  return [theme, toggleTheme];
}
