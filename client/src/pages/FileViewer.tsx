import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import { Header } from '@/components/layout/Header';
import type { BreadcrumbItem, FileContent } from '@/lib/api';
import { getFile } from '@/lib/api';
import { useTheme } from '@/lib/theme';

export function FileViewer() {
  const params = useParams<{ '*': string }>();
  const reqPath = params['*'] ?? '';
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
    setLoading(true);
    setError(null);
    getFile(reqPath)
      .then(setFile)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [reqPath]);

  const breadcrumbs: BreadcrumbItem[] = file?.breadcrumbs ?? [];

  return (
      <div className="min-h-screen bg-background text-foreground">
        <div ref={topBarRef} className="fixed top-0 left-0 right-0 z-50">
          <Header
            breadcrumbs={breadcrumbs}
            isInsider={file?.isInsider ?? true}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        </div>

        <main className="p-4 md:p-6 pb-16 overflow-y-auto" style={{ marginTop: `${topBarHeight}px`, height: `calc(100vh - ${topBarHeight}px)` }}>
          {loading && <div className="text-muted-foreground text-sm">Loading...</div>}
          {error && <div className="text-destructive text-sm">Error: {error}</div>}

          {file?.type === 'markdown' && file.html && (
            <article
              className="prose max-w-none bg-background p-6 rounded-lg border border-border"
              style={{ '--tw-prose-body': 'var(--foreground)', '--tw-prose-headings': 'var(--foreground)', '--tw-prose-bold': 'var(--foreground)', '--tw-prose-links': '#3b82f6', '--tw-prose-code': 'var(--foreground)', '--tw-prose-pre-bg': 'var(--muted)', '--tw-prose-pre-code': 'var(--foreground)', '--tw-prose-hr': 'var(--border)', '--tw-prose-quotes': 'var(--muted-foreground)', '--tw-prose-quote-borders': 'var(--border)', '--tw-prose-th-borders': 'var(--border)', '--tw-prose-td-borders': 'var(--border)' } as React.CSSProperties}
              dangerouslySetInnerHTML={{ __html: file.html }}
            />
          )}

          {file?.type === 'text' && file.content && (
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
              <code>{file.content}</code>
            </pre>
          )}

          {file?.type === 'svg' && file.content && (
            <div
              className="flex justify-center p-4"
              dangerouslySetInnerHTML={{ __html: file.content }}
            />
          )}

          {file?.type === 'image' && (
            <div className="flex justify-center p-4">
              <img src={`/path/${reqPath}?raw=1`} alt={file.fileName} className="max-w-full" />
            </div>
          )}
        </main>
      </div>
  );
}
