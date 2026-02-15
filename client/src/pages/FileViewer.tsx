import { useEffect, useState } from 'react';
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
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="min-h-screen bg-background text-foreground">
        <Header
          breadcrumbs={breadcrumbs}
          isInsider={file?.isInsider ?? true}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <main className="p-4 md:p-6">
          {loading && <div className="text-muted-foreground text-sm">Loading...</div>}
          {error && <div className="text-destructive text-sm">Error: {error}</div>}

          {file?.type === 'markdown' && file.html && (
            <article
              className="prose prose-zinc dark:prose-invert max-w-none"
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
    </div>
  );
}
