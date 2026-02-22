/**
 * Renders content/*.md pages (terms, privacy) outside the file browser.
 * Fetches from /api/content/:file and renders markdown with minimal chrome.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { Header } from '@/components/layout/Header';

export function ContentPage() {
  const { file } = useParams<{ file: string }>();
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    fetch(`/api/content/${file}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Not found`);
        return r.json() as Promise<{ html: string }>;
      })
      .then((data) => setHtml(data.html))
      .catch((err: Error) => setError(err.message));
  }, [file]);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <Header fileName={`${file ?? ''}.md`} breadcrumbs={[]} isInsider={false} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          {error && <p className="text-red-500">Error: {error}</p>}
          {html && (
            <article
              className="prose prose-zinc dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
          {!html && !error && <p className="text-muted-foreground">Loading...</p>}
        </div>
      </main>
    </div>
  );
}
