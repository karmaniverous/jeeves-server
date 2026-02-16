import { FolderOpen, FileText, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Header } from '@/components/layout/Header';
import { ShareButton } from '@/components/ShareButton';
import { Input } from '@/components/ui/input';
import type { BreadcrumbItem, DirectoryEntry, DirectoryListing, DriveEntry, FileContent } from '@/lib/api';
import { getDrives, getDirectory, getFile, getShareLink } from '@/lib/api';
import { useTheme } from '@/lib/theme';

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
  const [file, setFile] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Header share (copy link for current page)
  const [headerCopied, setHeaderCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setDrives(null);
    setDirectory(null);
    setFile(null);

    if (!reqPath) {
      getDrives()
        .then(setDrives)
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    } else {
      // Try as directory first, then as file
      getDirectory(reqPath)
        .then((data) => {
          if ('entries' in data) {
            setDirectory(data);
          }
        })
        .catch(() => {
          // Not a directory — try as file
          return getFile(reqPath)
            .then(setFile)
            .catch((e: Error) => setError(e.message));
        })
        .finally(() => setLoading(false));
    }
  }, [reqPath]);

  useEffect(() => {
    localStorage.setItem('jeeves-share-expiry', expiry);
  }, [expiry]);

  const breadcrumbs: BreadcrumbItem[] = directory?.breadcrumbs ?? file?.breadcrumbs ?? [];
  const isInsider = directory?.isInsider ?? file?.isInsider ?? true;
  const insiderKey = ''; // Will come from auth context

  const handleHeaderShare = async () => {
    if (!directory || !insiderKey) return;
    try {
      const data = await getShareLink(insiderKey, `/${reqPath}`, undefined);
      if (data.url) {
        await navigator.clipboard.writeText(window.location.origin + data.url);
        setHeaderCopied(true);
        setTimeout(() => setHeaderCopied(false), 1500);
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="min-h-screen bg-background text-foreground">
        <Header
          breadcrumbs={breadcrumbs}
          isInsider={isInsider}
          theme={theme}
          onToggleTheme={toggleTheme}
        >
          {isInsider && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Link:</span>
              <Input
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                placeholder="1h"
                className="w-14 h-7 text-xs bg-zinc-700 border-zinc-600 text-white px-2"
                title="Expiry: 15m, 1h, 7d"
              />
              <button
                className={`text-sm ${headerCopied ? 'text-green-400' : 'text-zinc-400 hover:text-white'}`}
                onClick={handleHeaderShare}
                title="Copy link to this directory"
              >
                {headerCopied ? <Check className="h-4 w-4" /> : '📋'}
              </button>
            </div>
          )}
        </Header>

        <main className="p-4 md:p-6">
          {loading && (
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
                    {drives.map((drive) => (
                      <tr key={drive.letter} className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors">
                        <td className="px-4 py-2.5">
                          <Link
                            to={`/browse/${drive.letter.toLowerCase()}`}
                            className="text-blue-500 hover:underline flex items-center gap-2"
                          >
                            💾 {drive.letter}:\{drive.label ? ` (${drive.label})` : ''}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground text-sm">Drive</td>
                      </tr>
                    ))}
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
                      {isInsider && (
                        <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Share
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {directory.entries.map((entry) => (
                      <DirectoryRow
                        key={entry.name}
                        entry={entry}
                        basePath={reqPath}
                        isInsider={isInsider}
                        insiderKey={insiderKey}
                        expiry={expiry}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* File viewer */}
          {!loading && !error && file && (
            <div>
              {file.type === 'markdown' && file.html && (
                <div className="flex gap-6">
                  {/* TOC sidebar */}
                  {file.headings && file.headings.length > 2 && (
                    <aside className="toc-sidebar hidden lg:block w-56 shrink-0">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Contents</div>
                      <nav className="border-l border-border pl-3">
                        {file.headings.map((h) => (
                          <a
                            key={h.slug}
                            href={`#${h.slug}`}
                            style={{ paddingLeft: `${(h.level - 1) * 0.75}rem` }}
                          >
                            {h.text}
                          </a>
                        ))}
                      </nav>
                    </aside>
                  )}
                  <div className="min-w-0 flex-1">
                    {/* Export buttons */}
                    <div className="flex gap-2 mb-4">
                      <a
                        href={`/path/${reqPath}?export=pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted hover:bg-accent border border-border rounded-md transition-colors"
                      >
                        📄 PDF
                      </a>
                      <a
                        href={`/path/${reqPath}?export=docx`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted hover:bg-accent border border-border rounded-md transition-colors"
                      >
                        📝 DOCX
                      </a>
                      <a
                        href={`/path/${reqPath}?raw=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted hover:bg-accent border border-border rounded-md transition-colors"
                      >
                        📋 Raw
                      </a>
                    </div>
                    <article
                      className="prose prose-zinc dark:prose-invert max-w-none bg-background p-6 rounded-lg border border-border"
                      dangerouslySetInnerHTML={{ __html: file.html }}
                    />
                  </div>
                </div>
              )}

              {file.type === 'text' && file.content && (
                <div>
                  <div className="flex gap-2 mb-4">
                    <a
                      href={`/path/${reqPath}?raw=1`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted hover:bg-accent border border-border rounded-md transition-colors"
                    >
                      📋 Raw
                    </a>
                  </div>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm border border-border">
                    <code>{file.content}</code>
                  </pre>
                </div>
              )}

              {file.type === 'svg' && file.content && (
                <div>
                  <div className="flex gap-2 mb-4">
                    <a
                      href={`/path/${reqPath}?raw=1`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted hover:bg-accent border border-border rounded-md transition-colors"
                    >
                      🔗 Open SVG
                    </a>
                  </div>
                  <div
                    className="flex justify-center p-4 bg-white rounded-lg border border-border overflow-auto [&>svg]:max-w-full [&>svg]:h-auto"
                    dangerouslySetInnerHTML={{ __html: file.content }}
                  />
                </div>
              )}

              {file.type === 'image' && (
                <div className="flex justify-center p-4">
                  <img src={`/path/${reqPath}?raw=1`} alt={file.fileName} className="max-w-full rounded-lg shadow-md" />
                </div>
              )}

              {file.type === 'binary' && (
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
          )}
        </main>
      </div>
    </div>
  );
}

interface DirectoryRowProps {
  entry: DirectoryEntry;
  basePath: string;
  isInsider: boolean;
  insiderKey: string;
  expiry: string;
}

function DirectoryRow({ entry, basePath, isInsider, insiderKey, expiry }: DirectoryRowProps) {
  const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;
  const isDir = entry.type === 'directory';
  const hasPage = isDir || PAGE_EXTENSIONS.has(entry.ext);
  const hasRaw = !isDir;
  const urlPath = `/${entryPath}`;

  const typeLabel = isDir ? 'Directory' : entry.ext ? entry.ext.slice(1).toUpperCase() : 'File';

  return (
    <tr className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors">
      <td className="px-4 py-2.5">
        <Link
          to={`/browse/${entryPath}`}
          className="text-blue-500 hover:underline flex items-center gap-2"
        >
          {isDir ? <FolderOpen className="h-4 w-4 text-yellow-500 shrink-0" /> : <FileText className="h-4 w-4 text-zinc-400 shrink-0" />}
          <span className="truncate">{entry.name}</span>
        </Link>
      </td>
      <td className="px-4 py-2.5 text-muted-foreground text-sm">{typeLabel}</td>
      <td className="px-4 py-2.5 text-muted-foreground text-sm">{formatSize(entry.size)}</td>
      <td className="px-4 py-2.5 text-muted-foreground text-sm">{entry.mtime ?? '-'}</td>
      {isInsider && (
        <td className="px-4 py-2.5 text-center whitespace-nowrap">
          {hasPage && (
            <ShareButton type="page" path={urlPath} insiderKey={insiderKey} expiry={expiry} />
          )}
          {hasRaw && (
            <ShareButton type="raw" path={urlPath} insiderKey={insiderKey} expiry={expiry} />
          )}
        </td>
      )}
    </tr>
  );
}
