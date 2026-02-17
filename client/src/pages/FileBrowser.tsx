import { Loader2, Menu, Minus, Minimize2, Maximize2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { CodeBlock } from '@/components/CodeBlock';
import { DirectoryTable } from '@/components/DirectoryTable';
import { DownloadDropdown } from '@/components/DownloadDropdown';
import { DriveList } from '@/components/DriveList';
import { Header } from '@/components/layout/Header';
import { LinkDropdown } from '@/components/LinkDropdown';
import { MermaidViewer } from '@/components/MermaidViewer';
import { SvgViewer } from '@/components/SvgViewer';
import type { BreadcrumbItem, DirectoryListing, DriveEntry, FileContent, ShareSettings } from '@/lib/api';
import { getDrives, getDirectory, getFile, getFileRaw } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { initInlineSvgPanzoom } from '@/components/InlineSvgPanzoom';
import { injectCopyButtons } from '@/lib/codeBlockCopy';
import { useTheme } from '@/lib/theme';

const SCROLL_DURATION = 600;

function smoothScrollTo(container: HTMLElement | Window, targetY: number) {
  const isWindow = container === window;
  const startY = isWindow ? window.scrollY : (container as HTMLElement).scrollTop;
  const diff = targetY - startY;
  if (Math.abs(diff) < 2) return;
  const startTime = performance.now();

  function step(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / SCROLL_DURATION, 1);
    const ease = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    if (isWindow) {
      window.scrollTo(0, startY + diff * ease);
    } else {
      (container as HTMLElement).scrollTop = startY + diff * ease;
    }
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

function scrollToIdInContainer(container: HTMLElement | null, id: string) {
  const el = document.getElementById(id);
  if (el && container) {
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const top = container.scrollTop + (elRect.top - containerRect.top) - 16;
    smoothScrollTo(container, top);
    window.history.replaceState(null, '', `#${id}`);
  }
}

function formatRelativeTime(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${String(mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${String(hours)}h ago`;
  const days = Math.floor(hours / 24);
  return `${String(days)}d ago`;
}

function isRenderable(file: FileContent): boolean {
  return file.type === 'markdown' || file.type === 'svg' || file.type === 'mermaid';
}

const RENDERABLE_EXTENSIONS = new Set(['.md', '.svg', '.mmd']);

function loadShareSettings(): ShareSettings {
  const saved = localStorage.getItem('jeeves-share-settings');
  if (saved) try { return JSON.parse(saved) as ShareSettings; } catch { /* ignore */ }
  return { expiry: localStorage.getItem('jeeves-share-expiry') ?? '', depth: 0, dirs: false };
}

export function FileBrowser() {
  const params = useParams<{ '*': string }>();
  const reqPath = params['*'] ?? '';
  const [theme, toggleTheme] = useTheme();
  const [shareSettings, setShareSettings] = useState<ShareSettings>(loadShareSettings);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const [proseWidth, setProseWidth] = useState<'narrow' | 'medium' | 'wide'>(
    () => (localStorage.getItem('jeeves-prose-width') as 'narrow' | 'medium' | 'wide') ?? 'medium'
  );
  const toggleProseWidth = (w: 'narrow' | 'medium' | 'wide') => {
    setProseWidth(w);
    localStorage.setItem('jeeves-prose-width', w);
  };

  const [drives, setDrives] = useState<DriveEntry[] | null>(null);
  const [directory, setDirectory] = useState<DirectoryListing | null>(null);
  const [fileRaw, setFileRaw] = useState<FileContent | null>(null);
  const [fileRendered, setFileRendered] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'raw' ? 'raw' : 'rendered';
  const [viewTab, setViewTabState] = useState<'rendered' | 'raw'>(initialTab);
  const setViewTab = (tab: 'rendered' | 'raw') => {
    setViewTabState(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'rendered') next.delete('tab');
      else next.set('tab', tab);
      return next;
    }, { replace: true });
  };

  const file = fileRendered ?? fileRaw;

  useEffect(() => {
    setLoading(true);
    setError(null);
    setDrives(null);
    setDirectory(null);
    setFileRaw(null);
    setFileRendered(null);
    setViewTabState(searchParams.get('tab') === 'raw' ? 'raw' : 'rendered');

    if (!reqPath) {
      getDrives()
        .then(setDrives)
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    } else {
      getDirectory(reqPath)
        .then((data) => {
          if ('entries' in data) {
            setDirectory(data);
            setLoading(false);
          } else {
            getFileRaw(reqPath).then((raw) => { setFileRaw(raw); setLoading(false); }).catch(() => {});
            getFile(reqPath).then(setFileRendered).catch(() => {});
          }
        })
        .catch(() => {
          getFileRaw(reqPath).then((raw) => { setFileRaw(raw); setLoading(false); }).catch((e: Error) => { setError(e.message); setLoading(false); });
          getFile(reqPath).then(setFileRendered).catch(() => {});
        });
    }
  }, [reqPath]);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && file) {
      const timer = setTimeout(() => scrollToIdInContainer(mainRef.current, hash), 100);
      return () => clearTimeout(timer);
    }
  }, [file]);

  useEffect(() => {
    localStorage.setItem('jeeves-share-settings', JSON.stringify(shareSettings));
  }, [shareSettings]);

  const { isInsider: authInsider, keyCreatedAt, rotateKey } = useAuth();
  const breadcrumbs: BreadcrumbItem[] = directory?.breadcrumbs ?? file?.breadcrumbs ?? [];
  const isInsider = directory?.isInsider ?? file?.isInsider ?? authInsider;
  const keyAge = keyCreatedAt ? formatRelativeTime(keyCreatedAt) : null;

  const handleRotateKey = async () => {
    if (!confirm('Rotate your insider key?\n\nThis will INVALIDATE all existing share links.')) return;
    await rotateKey();
  };

  const topBarRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [topBarHeight, setTopBarHeight] = useState(96);
  const measureTopBar = useCallback(() => {
    if (topBarRef.current) setTopBarHeight(topBarRef.current.offsetHeight);
  }, []);
  useEffect(() => {
    measureTopBar();
    window.addEventListener('resize', measureTopBar);
    return () => window.removeEventListener('resize', measureTopBar);
  }, [measureTopBar]);
  useEffect(() => { measureTopBar(); }, [file, directory, drives, measureTopBar]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Fixed top bar */}
      <div ref={topBarRef} className="fixed top-0 left-0 right-0 z-50">
        <Header
          breadcrumbs={breadcrumbs}
          isInsider={isInsider}
          theme={theme}
          onToggleTheme={toggleTheme}
          keyAge={keyAge}
          onRotateKey={handleRotateKey}
          downloadDropdown={
            file ? (
              <DownloadDropdown reqPath={reqPath} file={file} variant="header" />
            ) : directory ? (
              <DownloadDropdown reqPath={reqPath} file={null} isDirectory variant="header" />
            ) : undefined
          }
          linkControls={isInsider ? (
            <LinkDropdown path={`/${reqPath}`} shareSettings={shareSettings} onShareSettingsChange={setShareSettings} showEvent showRaw={!!file} variant="header" />
          ) : undefined}
        />

        {/* Tabs for file views */}
        {(file || (loading && reqPath)) && (() => {
          const ext = reqPath ? `.${reqPath.split('.').pop()?.toLowerCase()}` : '';
          const renderable = file ? isRenderable(file) : RENDERABLE_EXTENSIONS.has(ext);
          const activeTab = renderable ? viewTab : 'raw';
          return (
            <div className="flex items-center gap-1 border-b border-border bg-background px-4 md:px-6">
              {fileRendered?.headings && fileRendered.headings.length > 2 && (
                <button
                  onClick={() => setMobileTocOpen(!mobileTocOpen)}
                  className="lg:hidden p-1.5 mr-1 text-muted-foreground hover:text-foreground transition-colors"
                  title="Table of contents"
                >
                  {mobileTocOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </button>
              )}
              {renderable && (
                <button
                  onClick={() => setViewTab('rendered')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'rendered'
                      ? 'border-blue-500 text-blue-500'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Rendered
                </button>
              )}
              <button
                onClick={() => setViewTab('raw')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'raw'
                    ? 'border-blue-500 text-blue-500'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Raw
              </button>
              {file?.type === 'markdown' && activeTab === 'rendered' && (
                <div className="hidden md:flex items-center ml-2 border border-border rounded-md overflow-hidden">
                  {(['narrow', 'medium', 'wide'] as const).map((w) => (
                    <button
                      key={w}
                      onClick={() => toggleProseWidth(w)}
                      className={`p-1.5 transition-colors ${
                        proseWidth === w ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title={`${w.charAt(0).toUpperCase() + w.slice(1)} width`}
                    >
                      {w === 'narrow' ? <Minimize2 className="h-3.5 w-3.5" /> : w === 'medium' ? <Minus className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      <main
        ref={mainRef}
        className={file || (loading && reqPath) ? 'px-0 pb-32 overflow-y-auto' : 'p-4 pb-32 md:px-6 md:pt-6 overflow-y-auto'}
        style={{ marginTop: `${topBarHeight}px`, height: `calc(100vh - ${topBarHeight}px)` }}
      >
        {loading && !reqPath && <div className="text-muted-foreground text-sm">Loading...</div>}
        {error && <div className="text-destructive text-sm">Error: {error}</div>}

        {/* Drive listing */}
        {!loading && !error && drives && (
          <DriveList drives={drives} isInsider={isInsider} shareSettings={shareSettings} onShareSettingsChange={setShareSettings} />
        )}

        {/* Directory listing */}
        {!loading && !error && directory && (
          <DirectoryTable entries={directory.entries} basePath={reqPath} isInsider={isInsider} shareSettings={shareSettings} onShareSettingsChange={setShareSettings} />
        )}

        {/* File viewer */}
        {!error && (file || (loading && reqPath)) && (() => {
          const ext = reqPath ? `.${reqPath.split('.').pop()?.toLowerCase()}` : '';
          const renderable = file ? isRenderable(file) : RENDERABLE_EXTENSIONS.has(ext);
          const fileLoading = !file;
          const activeTab = renderable ? viewTab : 'raw';

          return (
            <div>
              {/* Mobile TOC */}
              {mobileTocOpen && fileRendered?.headings && fileRendered.headings.length > 2 && (
                <>
                  <div className="lg:hidden fixed inset-0 z-40" onClick={() => setMobileTocOpen(false)} />
                  <div className="lg:hidden fixed left-2 right-2 z-50 bg-popover text-popover-foreground border border-border rounded-lg shadow-lg max-h-[60vh] overflow-y-auto px-4 py-3" style={{ top: `${topBarHeight + 4}px` }}>
                    <nav>
                      {fileRendered.headings.map((h) => (
                        <button
                          key={h.slug}
                          type="button"
                          onClick={() => { scrollToIdInContainer(mainRef.current, h.slug); setMobileTocOpen(false); }}
                          className="block text-left text-sm text-muted-foreground hover:text-foreground cursor-pointer py-1 transition-colors w-full"
                          style={{ paddingLeft: `${(h.level - 1) * 0.75}rem` }}
                        >
                          {h.text}
                        </button>
                      ))}
                    </nav>
                  </div>
                </>
              )}

              <div className="px-4 md:px-6 pt-4">
                {fileLoading && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                  </div>
                )}

                {(fileRaw ?? file)?.content && activeTab === 'raw' && (
                  <CodeBlock
                    content={(fileRaw ?? file)!.content!}
                    html={renderable ? null : (fileRendered ?? fileRaw)?.html}
                    language={renderable ? null : (fileRendered ?? fileRaw)?.language}
                  />
                )}

                {!fileRendered && renderable && activeTab === 'rendered' && !fileLoading && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" /> Rendering...
                  </div>
                )}

                {fileRendered?.type === 'markdown' && fileRendered.html && activeTab === 'rendered' && (
                  <div className="flex gap-6">
                    {fileRendered.headings && fileRendered.headings.length > 2 && (
                      <aside className="toc-sidebar hidden lg:block w-56 shrink-0" style={{ maxHeight: `calc(100vh - ${topBarHeight + 32}px)` }}>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Contents</div>
                        <nav className="border-l border-border pl-3">
                          {fileRendered.headings.map((h) => (
                            <button
                              key={h.slug}
                              type="button"
                              onClick={() => scrollToIdInContainer(mainRef.current, h.slug)}
                              className="block text-left text-sm text-muted-foreground hover:text-foreground cursor-pointer py-0.5 transition-colors"
                              style={{ paddingLeft: `${(h.level - 1) * 0.75}rem` }}
                            >
                              {h.text}
                            </button>
                          ))}
                        </nav>
                      </aside>
                    )}
                    <article
                      ref={(el) => { if (el) { injectCopyButtons(el); initInlineSvgPanzoom(el); } }}
                      className={`prose bg-background p-6 rounded-lg border border-border min-w-0 flex-1 ${proseWidth === 'narrow' ? 'max-w-prose' : proseWidth === 'medium' ? 'max-w-5xl' : 'max-w-none'}`}
                      style={{ '--tw-prose-body': 'var(--foreground)', '--tw-prose-headings': 'var(--foreground)', '--tw-prose-bold': 'var(--foreground)', '--tw-prose-links': '#3b82f6', '--tw-prose-code': 'var(--foreground)', '--tw-prose-pre-bg': 'var(--muted)', '--tw-prose-pre-code': 'var(--foreground)', '--tw-prose-hr': 'var(--border)', '--tw-prose-quotes': 'var(--muted-foreground)', '--tw-prose-quote-borders': 'var(--border)', '--tw-prose-th-borders': 'var(--border)', '--tw-prose-td-borders': 'var(--border)' } as React.CSSProperties}
                      dangerouslySetInnerHTML={{ __html: fileRendered.html! }}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        const anchor = target.closest('a');
                        const href = anchor?.getAttribute('href');
                        if (href?.startsWith('#')) {
                          e.preventDefault();
                          scrollToIdInContainer(mainRef.current, href.slice(1));
                        }
                      }}
                    />
                  </div>
                )}

                {fileRendered?.type === 'svg' && fileRendered.content && activeTab === 'rendered' && (
                  <SvgViewer content={fileRendered.content} />
                )}

                {fileRendered?.type === 'mermaid' && activeTab === 'rendered' && (
                  <MermaidViewer html={fileRendered.html ?? null} content={fileRendered.content ?? ''} />
                )}

                {file?.type === 'image' && (
                  <div className="flex justify-center p-4">
                    <img src={`/api/raw/${reqPath}`} alt={file.fileName} className="max-w-full rounded-lg shadow-md" />
                  </div>
                )}

                {file?.type === 'binary' && (
                  <div className="text-center p-8">
                    <p className="text-muted-foreground mb-4">{file.fileName}</p>
                    <a
                      href={`/api/raw/${reqPath}`}
                      download={file.fileName}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                    >
                      Download
                    </a>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </main>
    </div>
  );
}
