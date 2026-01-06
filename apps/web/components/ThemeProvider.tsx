"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'dark' | 'light';

const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'dark', toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');
  // Init theme before paint
  useEffect(() => {
    const saved = (typeof window !== 'undefined' && (localStorage.getItem('theme') as Theme | null));
    const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial: Theme = saved || (prefersDark ? 'dark' : 'light');
    setTheme(initial);
    const root = document.documentElement;
    if (initial === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    root.setAttribute('data-theme', initial);
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    root.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  return (
    <ThemeCtx.Provider value={{ theme, toggle: () => setTheme(t => (t === 'dark' ? 'light' : 'dark')) }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggle } = useTheme();
  if (compact) {
    return (
      <button
        onClick={toggle}
        aria-label={theme === 'dark' ? 'Basculer en mode clair' : 'Basculer en mode sombre'}
        className="h-8 w-8 inline-flex items-center justify-center rounded border border-[color:var(--border)] hover:bg-[color:var(--panel)] text-[color:var(--text)]"
      >
        {theme === 'dark' ? (
          // Sun icon
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <path d="M12 4.5a1 1 0 0 1 1 1V7a1 1 0 1 1-2 0V5.5a1 1 0 0 1 1-1Zm0 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.5-3.5a1 1 0 0 1 1 1v.001a1 1 0 1 1-2 0V13a1 1 0 0 1 1-1ZM12 17a1 1 0 0 1 1 1v1.5a1 1 0 1 1-2 0V18a1 1 0 0 1 1-1Zm-7.5-3.5a1 1 0 0 1 1 1V15a1 1 0 1 1-2 0v-.5a1 1 0 0 1 1-1Zm11.95-6.45a1 1 0 1 1 1.414-1.414l1.06 1.06A1 1 0 0 1 18.55 7.7l-1.06-1.06Zm-11.314 0L4.95 5.64A1 1 0 1 1 6.364 7.05L5.303 8.11A1 1 0 0 1 3.89 6.697ZM17.186 17.186a1 1 0 0 1 1.414 0l1.06 1.06A1 1 0 1 1 18.246 19.66l-1.06-1.06a1 1 0 0 1 0-1.414ZM5.303 15.89a1 1 0 0 1 0 1.414L4.243 18.36A1 1 0 1 1 2.829 16.95l1.06-1.06a1 1 0 0 1 1.414 0Z"/>
          </svg>
        ) : (
          // Moon icon
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 1 0 9.79 9.79Z" />
          </svg>
        )}
      </button>
    );
  }
  return (
    <button onClick={toggle} className="text-sm rounded px-2 py-1" style={{ color: 'var(--text)', border: '1px solid var(--border)' }}>
      {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
    </button>
  );
}

