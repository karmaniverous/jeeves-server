import { FileText, FolderOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

import { DownloadDropdown } from '@/components/DownloadDropdown';
import { LinkDropdown } from '@/components/LinkDropdown';
import type { DirectoryEntry, ShareSettings } from '@/lib/api';
import { entryLinkTarget } from '@/lib/directoryEntryLink';

function formatSize(bytes: number | null): string {
  if (bytes === null) return '-';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

interface DirectoryRowProps {
  entry: DirectoryEntry;
  basePath: string;
  isInsider: boolean;
  shareSettings: ShareSettings;
  onShareSettingsChange: (settings: ShareSettings) => void;
}

export function DirectoryRow({
  entry,
  basePath,
  isInsider,
  shareSettings,
  onShareSettingsChange,
}: DirectoryRowProps) {
  const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;
  const isDir = entry.type === 'directory';
  const hasRaw = !isDir;
  const urlPath = `/${entryPath}`;
  const target = entryLinkTarget(entryPath, entry.shareUrl);
  // Deep-share listings: entry downloads need the entry's own key, so they
  // are offered on the entry's page instead.
  const showDownloads = entry.shareUrl === undefined;
  const label = (
    <>
      {isDir ? (
        <FolderOpen className="h-4 w-4 text-yellow-500 shrink-0" />
      ) : (
        <FileText className="h-4 w-4 text-zinc-400 shrink-0" />
      )}
      <span className="truncate">{entry.name}</span>
    </>
  );
  const typeLabel = isDir
    ? 'Directory'
    : entry.ext
      ? entry.ext.slice(1).toUpperCase()
      : 'File';

  return (
    <tr className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          {target.kind === 'route' && (
            <Link
              to={target.to}
              className="text-blue-500 hover:underline flex items-center gap-2 min-w-0"
            >
              {label}
            </Link>
          )}
          {target.kind === 'share' && (
            <a
              href={target.href}
              className="text-blue-500 hover:underline flex items-center gap-2 min-w-0"
            >
              {label}
            </a>
          )}
          {target.kind === 'none' && (
            <span className="flex items-center gap-2 min-w-0 text-muted-foreground">
              {label}
            </span>
          )}
          <div className="ml-auto flex items-center gap-0.5 shrink-0">
            {isInsider && (
              <LinkDropdown
                path={urlPath}
                shareSettings={shareSettings}
                onShareSettingsChange={onShareSettingsChange}
                showRaw={hasRaw}
                compact
                isDirectory={isDir}
              />
            )}
            {showDownloads && (
              <DownloadDropdown
                reqPath={entryPath}
                file={isDir ? null : { fileName: entry.name, type: entry.ext }}
                isDirectory={isDir}
                compact
              />
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5 text-muted-foreground text-sm">{typeLabel}</td>
      <td className="px-4 py-2.5 text-muted-foreground text-sm">
        {isDir
          ? entry.itemCount != null
            ? `${entry.itemCount} ${entry.itemCount === 1 ? 'item' : 'items'}`
            : '-'
          : formatSize(entry.size)}
      </td>
      <td className="px-4 py-2.5 text-muted-foreground text-sm">
        {entry.mtime ?? '-'}
      </td>
    </tr>
  );
}
