import { useEffect, useState } from 'react';

import { Header } from '@/components/layout/Header';
import type { FileContent } from '@/lib/api';
import { useTheme } from '@/lib/theme';

export function About() {
  const [theme, toggleTheme] = useTheme();
  const [file, setFile] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The about.md lives at the repo root — we use a dedicated API endpoint
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
        <Header
          breadcrumbs={[{ label: 'About', path: 'about' }]}
          isInsider={false}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <main className="p-4 md:p-6 pt-16 max-w-4xl mx-auto">
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
