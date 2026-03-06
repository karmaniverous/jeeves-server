import { useCallback, useEffect, useRef, useState } from 'react';

import { Header } from '@/components/layout/Header';
import type { FileContent } from '@/lib/api';
import { useTheme } from '@/lib/theme';

export function About() {
  const [theme, toggleTheme] = useTheme();
  const [file, setFile] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const topBarRef = useRef<HTMLDivElement>(null);
  const [topBarHeight, setTopBarHeight] = useState(56);
  const measure = useCallback(() => {
    if (topBarRef.current) setTopBarHeight(topBarRef.current.offsetHeight);
  }, []);
  useEffect(() => { measure(); window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure); }, [measure]);

  useEffect(() => {
    fetch('/api/about')
      .then(async (res) => {
        if (!res.ok) throw new Error(`${String(res.status)}`);
        return res.json() as Promise<FileContent>;
      })
      .then(setFile)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
      <div className="min-h-screen bg-background text-foreground">
        <div ref={topBarRef} className="fixed top-0 left-0 right-0 z-50">
          <Header
            breadcrumbs={[{ label: 'About', path: 'about' }]}
            isInsider={false}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        </div>

        <main className="p-4 pb-32 md:px-6 md:pt-6 max-w-4xl mx-auto overflow-y-auto" style={{ marginTop: `${topBarHeight}px`, height: `calc(100vh - ${topBarHeight}px)` }}>
          {loading && <div className="text-muted-foreground text-sm">Loading...</div>}
          {error && <div className="text-muted-foreground text-sm">About page not available.</div>}

          {file?.type === 'markdown' && file.html && (
            <article
              className="prose max-w-none bg-background p-6 rounded-lg border border-border"
              style={{ '--tw-prose-body': 'var(--foreground)', '--tw-prose-headings': 'var(--foreground)', '--tw-prose-bold': 'var(--foreground)', '--tw-prose-links': '#3b82f6', '--tw-prose-code': 'var(--foreground)', '--tw-prose-pre-bg': 'var(--muted)', '--tw-prose-pre-code': 'var(--foreground)', '--tw-prose-hr': 'var(--border)', '--tw-prose-quotes': 'var(--muted-foreground)', '--tw-prose-quote-borders': 'var(--border)', '--tw-prose-th-borders': 'var(--border)', '--tw-prose-td-borders': 'var(--border)' } as React.CSSProperties}
              dangerouslySetInnerHTML={{ __html: file.html }}
            />
          )}
        </main>
      </div>
  );
}
