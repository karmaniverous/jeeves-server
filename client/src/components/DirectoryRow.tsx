import { FileText, FolderOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

import { DownloadDropdown } from '@/components/DownloadDropdown';
import { LinkDropdown } from '@/components/LinkDropdown';
import type { DirectoryEntry, ShareSettings } from '@/lib/api';

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

interface DirectoryRowProps {
  entry: DirectoryEntry;
  basePath: string;
  isInsider: boolean;
  shareSettings: ShareSettings;
  onShareSettingsChange: (settings: ShareSettings) => void;
}

export function DirectoryRow({ entry, basePath, isInsider, shareSettings, onShareSettingsChange }: DirectoryRowProps) {
  const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;
  const isDir = entry.type === 'directory';
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
              <LinkDropdown path={urlPath} shareSettings={shareSettings} onShareSettingsChange={onShareSettingsChange} showRaw={hasRaw} compact isDirectory={isDir} />
              <DownloadDropdown
                reqPath={entryPath}
                file={isDir ? null : { fileName: entry.name, type: entry.ext }}
                isDirectory={isDir}
                isInsider={isInsider}
                compact
              />
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
