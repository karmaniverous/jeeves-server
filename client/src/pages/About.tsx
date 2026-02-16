import { useEffect, useState } from 'react';

import { Header } from '@/components/layout/Header';
import type { FileContent } from '@/lib/api';
import { getFile } from '@/lib/api';
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
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="min-h-screen bg-background text-foreground">
        <Header
          breadcrumbs={[{ label: 'About', path: 'about' }]}
          isInsider={false}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <main className="p-4 md:p-6 max-w-4xl mx-auto">
          {loading && <div className="text-muted-foreground text-sm">Loading...</div>}
          {error && <div className="text-muted-foreground text-sm">About page not available.</div>}

          {file?.type === 'markdown' && file.html && (
            <article
              className="prose prose-zinc dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: file.html }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
