/**
 * PublicContent page — renders public markdown (privacy, terms, readme)
 * without requiring authentication, reusing the same components as FileBrowser.
 */
import { useEffect, useRef, useState } from 'react';

import { Header } from '@/components/layout/Header';
import { MarkdownView } from '@/components/MarkdownView';
import { useTopBar } from '@/hooks/useTopBar';
import type { FileContent } from '@/lib/api';
import { useTheme } from '@/lib/theme';

interface PublicContentProps {
  slug: string;
}

/** Map slug to a display title for breadcrumbs. */
const TITLES: Record<string, string> = {
  readme: 'User Guide',
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
};

export function PublicContent({ slug }: PublicContentProps) {
  const [theme, toggleTheme] = useTheme();
  const [file, setFile] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const { topBarRef, topBarHeight } = useTopBar();

  const title = TITLES[slug] ?? slug;

  // Re-fetch when slug changes
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/public-content/${slug}`);
        if (!r.ok) throw new Error(`HTTP ${String(r.status)}`);
        const data = (await r.json()) as FileContent;
        if (!cancelled) {
          setFile(data);
          setError(null);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setFile(null);
          setError(
            err instanceof Error ? err.message : 'Failed to load content',
          );
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div ref={topBarRef} className="fixed top-0 left-0 right-0 z-50">
        <Header
          isInsider={false}
          theme={theme}
          onToggleTheme={toggleTheme}
          breadcrumbs={[{ label: title, path: slug }]}
        />
      </div>

      <main
        ref={mainRef}
        className="px-0 pb-32 overflow-y-auto"
        style={{
          marginTop: `${String(topBarHeight)}px`,
          height: `calc(100vh - ${String(topBarHeight)}px)`,
        }}
      >
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
            Loading…
          </div>
        )}

        {error && (
          <div className="text-destructive text-sm p-6">
            Failed to load content: {error}
          </div>
        )}

        {file?.type === 'markdown' && file.html && (
          <div className="px-4 md:px-6 pt-4">
            <MarkdownView
              fileRendered={file}
              fileRaw={file}
              reqPath={slug}
              proseWidth="medium"
              topBarHeight={topBarHeight}
              mainRef={mainRef}
              mobileTocOpen={mobileTocOpen}
              setMobileTocOpen={setMobileTocOpen}
              refetch={async () => {}}
            />
          </div>
        )}
      </main>
    </div>
  );
}
