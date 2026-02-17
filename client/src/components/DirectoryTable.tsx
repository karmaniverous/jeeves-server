import { DirectoryRow } from '@/components/DirectoryRow';
import type { DirectoryEntry, ShareSettings } from '@/lib/api';

interface DirectoryTableProps {
  entries: DirectoryEntry[];
  basePath: string;
  isInsider: boolean;
  shareSettings: ShareSettings;
  onShareSettingsChange: (settings: ShareSettings) => void;
}

export function DirectoryTable({ entries, basePath, isInsider, shareSettings, onShareSettingsChange }: DirectoryTableProps) {
  return (
    <div>
      <p className="text-muted-foreground text-sm mb-4">{entries.length} items</p>
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
            {entries.map((entry) => (
              <DirectoryRow
                key={entry.name}
                entry={entry}
                basePath={basePath}
                isInsider={isInsider}
                shareSettings={shareSettings}
                onShareSettingsChange={onShareSettingsChange}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
