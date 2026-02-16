import { useState, useCallback, useEffect } from 'react';

type Theme = 'light' | 'dark';

function applyThemeClass(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('jeeves-theme');
    const t = (saved === 'dark' ? 'dark' : 'light') as Theme;
    applyThemeClass(t);
    return t;
  });

  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('jeeves-theme', next);
      return next;
    });
  }, []);

  return [theme, toggleTheme];
}
