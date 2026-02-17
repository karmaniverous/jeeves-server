import { Link } from 'react-router-dom';

import { LinkDropdown } from '@/components/LinkDropdown';
import type { DriveEntry, ShareSettings } from '@/lib/api';

interface DriveListProps {
  drives: DriveEntry[];
  isInsider: boolean;
  shareSettings: ShareSettings;
  onShareSettingsChange: (settings: ShareSettings) => void;
}

export function DriveList({ drives, isInsider, shareSettings, onShareSettingsChange }: DriveListProps) {
  return (
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
                          <LinkDropdown path={drivePath} shareSettings={shareSettings} onShareSettingsChange={onShareSettingsChange} compact />
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
  );
}
