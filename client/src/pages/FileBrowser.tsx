import { FileText, FolderOpen, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { CodeBlock } from '@/components/CodeBlock';
import { DownloadDropdown } from '@/components/DownloadDropdown';
import { Header } from '@/components/layout/Header';
import { LinkDropdown } from '@/components/LinkDropdown';
import { MermaidViewer } from '@/components/MermaidViewer';
import { SvgViewer } from '@/components/SvgViewer';
import type { BreadcrumbItem, DirectoryEntry, DirectoryListing, DriveEntry, FileContent } from '@/lib/api';
import { getDrives, getDirectory, getFile, getFileRaw } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { injectCopyButtons } from '@/lib/codeBlockCopy';
import { useTheme } from '@/lib/theme';

const HEADER_OFFSET = 80;
const SCROLL_DURATION = 600; // ms

function smoothScrollTo(targetY: number) {
  const startY = window.scrollY;
  const diff = targetY - startY;
  if (Math.abs(diff) < 2) return;
  const startTime = performance.now();

  function step(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / SCROLL_DURATION, 1);
    // easeInOutCubic
    const ease = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    window.scrollTo(0, startY + diff * ease);
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) {
    const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
    smoothScrollTo(top);
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

/** Check if a file has a distinct rendered view (vs just syntax-highlighted text) */
function isRenderable(file: FileContent): boolean {
  return file.type === 'markdown' || file.type === 'svg' || file.type === 'mermaid';
}

/** Extensions with Rendered/Raw tabs */
const RENDERABLE_EXTENSIONS = new Set(['.md', '.svg', '.mmd']);

/** Extensions that render a page view */
const PAGE_EXTENSIONS = new Set([
  '.md', '.svg', '.txt', '.json', '.yaml', '.yml', '.html', '.css', '.js', '.ts',
  '.xml', '.csv', '.jsonl', '.log', '.mmd', '.ps1', '.bat', '.cmd', '.sh', '.py',
  '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp',
]);

function formatSize(bytes: number | null): string {
  if (bytes === null) return '-';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

export function FileBrowser() {
  const params = useParams<{ '*': string }>();
  const reqPath = params['*'] ?? '';
  const [theme, toggleTheme] = useTheme();
  const [expiry, setExpiry] = useState(() => localStorage.getItem('jeeves-share-expiry') ?? '');

  // State for drives, directory, or file
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

  // Merged file object: raw first, rendered overlays when available
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
      // Try as directory first; if it's a file or 404, fetch as file
      getDirectory(reqPath)
        .then((data) => {
          if ('entries' in data) {
            setDirectory(data);
            setLoading(false);
          } else {
            // /api/path returned file metadata — fetch full content
            // Two parallel fetches: raw (fast) and rendered (potentially slow)
            getFileRaw(reqPath).then((raw) => { setFileRaw(raw); setLoading(false); }).catch(() => {});
            getFile(reqPath).then(setFileRendered).catch(() => {});
          }
        })
        .catch(() => {
          // Not a directory — try as file
          getFileRaw(reqPath).then((raw) => { setFileRaw(raw); setLoading(false); }).catch((e: Error) => { setError(e.message); setLoading(false); });
          getFile(reqPath).then(setFileRendered).catch(() => {});
        });
    }
  }, [reqPath]);

  // Scroll to hash anchor after content loads
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && file) {
      // Small delay to let the DOM render
      const timer = setTimeout(() => scrollToId(hash), 100);
      return () => clearTimeout(timer);
    }
  }, [file]);

  useEffect(() => {
    localStorage.setItem('jeeves-share-expiry', expiry);
  }, [expiry]);

  const { isInsider: authInsider, keyCreatedAt, rotateKey } = useAuth();
  const breadcrumbs: BreadcrumbItem[] = directory?.breadcrumbs ?? file?.breadcrumbs ?? [];
  const isInsider = directory?.isInsider ?? file?.isInsider ?? authInsider;

  const keyAge = keyCreatedAt ? formatRelativeTime(keyCreatedAt) : null;

  const handleRotateKey = async () => {
    if (!confirm('Rotate your insider key?\n\nThis will INVALIDATE all existing share links.')) return;
    await rotateKey();
  };

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="min-h-screen bg-background text-foreground">
        <Header
          breadcrumbs={breadcrumbs}
          isInsider={isInsider}
          theme={theme}
          onToggleTheme={toggleTheme}
          keyAge={keyAge}
          onRotateKey={handleRotateKey}
          downloadDropdown={
            file ? (
              <DownloadDropdown reqPath={reqPath} file={file} />
            ) : directory ? (
              <DownloadDropdown reqPath={reqPath} file={null} isDirectory />
            ) : undefined
          }
          linkControls={isInsider ? (
            <>
              <LinkDropdown path={`/${reqPath}`} expiry={expiry} showEvent showRaw={!!file} />
              <span className="text-xs text-zinc-500">expires:</span>
              <select value={expiry} onChange={(e) => setExpiry(e.target.value)} className="h-7 text-xs bg-zinc-700 border border-zinc-600 text-white px-1.5 rounded">
                <option value="">never</option>
                <option value="1h">1 hour</option>
                <option value="1d">1 day</option>
                <option value="1w">1 week</option>
                <option value="30d">1 month</option>
                <option value="365d">1 year</option>
              </select>
            </>
          ) : undefined}
        />

        <main className={file || (loading && reqPath) ? 'px-0 pb-4 md:pb-6' : 'p-4 md:p-6'}>
          {loading && !reqPath && (
            <div className="text-muted-foreground text-sm">Loading...</div>
          )}

          {error && (
            <div className="text-destructive text-sm">Error: {error}</div>
          )}

          {/* Drive listing */}
          {!loading && !error && drives && (
            <div>
              <p className="text-muted-foreground text-sm mb-4">{drives.length} drives</p>
              <div className="bg-muted/50 rounded-lg overflow-hidden border border-border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drives.map((drive) => {
                      const drivePath = `/${drive.letter.toLowerCase()}`;
                      return (
                      <tr key={drive.letter} className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/browse/${drive.letter.toLowerCase()}`}
                              className="text-blue-500 hover:underline flex items-center gap-2 min-w-0"
                            >
                              💾 {drive.letter}:\{drive.label ? ` (${drive.label})` : ''}
                            </Link>
                            {isInsider && (
                              <div className="ml-auto flex items-center gap-0.5 shrink-0">
                                <LinkDropdown path={drivePath} expiry={expiry} compact />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground text-sm">Drive</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Directory listing */}
          {!loading && !error && directory && (
            <div>
              <p className="text-muted-foreground text-sm mb-4">{directory.entries.length} items</p>
              <div className="bg-muted/50 rounded-lg overflow-hidden border border-border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Size</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Modified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {directory.entries.map((entry) => (
                      <DirectoryRow
                        key={entry.name}
                        entry={entry}
                        basePath={reqPath}
                        isInsider={isInsider}
                        expiry={expiry}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* File viewer */}
          {!error && (file || (loading && reqPath)) && (() => {
            const ext = reqPath ? `.${reqPath.split('.').pop()?.toLowerCase()}` : '';
            const renderable = file ? isRenderable(file) : RENDERABLE_EXTENSIONS.has(ext);
            const fileLoading = !file;
            // Non-renderable files force Raw tab
            const activeTab = renderable ? viewTab : 'raw';

            return (
            <div>
              {/* Tabs — always shown */}
              <div className="flex gap-1 border-b border-border sticky top-14 z-40 bg-background px-4 md:px-6 mb-4">
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
              </div>

              <div className="px-4 md:px-6">
              {/* Loading spinner */}
              {fileLoading && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              )}

              {/* Raw view — uses fileRaw (arrives first) or file */}
              {(fileRaw ?? file)?.content && activeTab === 'raw' && (
                <CodeBlock
                  content={(fileRaw ?? file)!.content!}
                  html={renderable ? null : (fileRendered ?? fileRaw)?.html}
                  language={renderable ? null : (fileRendered ?? fileRaw)?.language}
                />
              )}

              {/* Rendered tab loading spinner (raw loaded, rendered still pending) */}
              {!fileRendered && renderable && activeTab === 'rendered' && !fileLoading && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Rendering...
                </div>
              )}

              {/* Rendered markdown */}
              {fileRendered?.type === 'markdown' && fileRendered.html && activeTab === 'rendered' && (
                <div className="flex gap-6">
                  {fileRendered.headings && fileRendered.headings.length > 2 && (
                    <aside className="toc-sidebar hidden lg:block w-56 shrink-0">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Contents</div>
                      <nav className="border-l border-border pl-3">
                        {fileRendered.headings!.map((h) => (
                          <button
                            key={h.slug}
                            type="button"
                            onClick={() => scrollToId(h.slug)}
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
                    ref={(el) => { if (el) injectCopyButtons(el); }}
                    className="prose prose-zinc dark:prose-invert max-w-none bg-background p-6 rounded-lg border border-border min-w-0 flex-1"
                    dangerouslySetInnerHTML={{ __html: fileRendered.html! }}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      const anchor = target.closest('a');
                      const href = anchor?.getAttribute('href');
                      if (href?.startsWith('#')) {
                        e.preventDefault();
                        scrollToId(href.slice(1));
                      }
                    }}
                  />
                </div>
              )}

              {/* Rendered SVG */}
              {fileRendered?.type === 'svg' && fileRendered.content && activeTab === 'rendered' && (
                <SvgViewer content={fileRendered.content} />
              )}

              {/* Rendered Mermaid */}
              {fileRendered?.type === 'mermaid' && activeTab === 'rendered' && (
                <MermaidViewer html={fileRendered.html ?? null} content={fileRendered.content ?? ''} />
              )}

              {/* Image */}
              {file?.type === 'image' && (
                <div className="flex justify-center p-4">
                  <img src={`/path/${reqPath}?raw=1`} alt={file.fileName} className="max-w-full rounded-lg shadow-md" />
                </div>
              )}

              {/* Binary */}
              {file?.type === 'binary' && (
                <div className="text-center p-8">
                  <p className="text-muted-foreground mb-4">{file.fileName}</p>
                  <a
                    href={`/path/${reqPath}?raw=1`}
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
    </div>
  );
}

interface DirectoryRowProps {
  entry: DirectoryEntry;
  basePath: string;
  isInsider: boolean;
  expiry: string;
}

function DirectoryRow({ entry, basePath, isInsider, expiry }: DirectoryRowProps) {
  const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;
  const isDir = entry.type === 'directory';
  const hasPage = isDir || PAGE_EXTENSIONS.has(entry.ext);
  const hasRaw = !isDir;
  const urlPath = `/${entryPath}`;

  const typeLabel = isDir ? 'Directory' : entry.ext ? entry.ext.slice(1).toUpperCase() : 'File';

  return (
    <tr className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Link
            to={`/browse/${entryPath}`}
            className="text-blue-500 hover:underline flex items-center gap-2 min-w-0"
          >
            {isDir ? <FolderOpen className="h-4 w-4 text-yellow-500 shrink-0" /> : <FileText className="h-4 w-4 text-zinc-400 shrink-0" />}
            <span className="truncate">{entry.name}</span>
          </Link>
          {isInsider && (
            <div className="ml-auto flex items-center gap-0.5 shrink-0">
              <DownloadDropdown
                reqPath={entryPath}
                file={isDir ? null : { fileName: entry.name, type: entry.ext }}
                isDirectory={isDir}
                compact
              />
              <LinkDropdown path={urlPath} expiry={expiry} showRaw={hasRaw} compact />
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-2.5 text-muted-foreground text-sm">{typeLabel}</td>
      <td className="px-4 py-2.5 text-muted-foreground text-sm">{formatSize(entry.size)}</td>
      <td className="px-4 py-2.5 text-muted-foreground text-sm">{entry.mtime ?? '-'}</td>
    </tr>
  );
}
