import { Link as LinkIcon } from 'lucide-react';

import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ActionDropdown, DropdownErrorBanner, type ActionState } from '@/components/ActionDropdown';
import { useActionState } from '@/components/useActionState';
import { getShareLink, type ShareSettings } from '@/lib/api';

interface LinkDropdownProps {
  path: string;
  shareSettings: ShareSettings;
  onShareSettingsChange: (settings: ShareSettings) => void;
  showEvent?: boolean;
  showRaw?: boolean;
  compact?: boolean;
  isDirectory?: boolean;
  variant?: 'header' | 'default' | 'menuItem';
  onError?: (error: string) => void;
  onStateChange?: (state: ActionState) => void;
}

type LinkType = 'page' | 'raw' | 'event';

async function copyShareLink(path: string, settings: ShareSettings, type: LinkType, isDirectory?: boolean) {
  let expiryParam: string | undefined;
  if (settings.expiry) {
    const match = settings.expiry.match(/^(\d+)([hdw])$/i);
    if (match) {
      const val = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      const multiplier: Record<string, number> = { h: 3_600_000, d: 86_400_000, w: 604_800_000 };
      expiryParam = String(Date.now() + val * multiplier[unit]);
    }
  }

  const depth = !isDirectory && settings.depth > 0 ? settings.depth : undefined;
  const dirs = !isDirectory && settings.dirs ? true : undefined;

  const data = await getShareLink(path, expiryParam, depth, dirs);
  if (!data.url) throw new Error('No URL returned');

  let fullUrl = window.location.origin + data.url;
  if (type === 'raw') {
    const shareUrl = new URL(fullUrl);
    shareUrl.pathname = shareUrl.pathname.replace('/browse/', '/api/raw/');
    fullUrl = shareUrl.toString();
  } else if (type === 'event') {
    fullUrl = window.location.origin + '/event?key=' + data.url.split('key=')[1];
  }
  await navigator.clipboard.writeText(fullUrl);
}

const EXPIRY_OPTIONS = [
  { label: 'Never', value: '' },
  { label: '1 hour', value: '1h' },
  { label: '24 hours', value: '24h' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
];

export function LinkDropdown({ path, shareSettings, onShareSettingsChange, showEvent, showRaw, compact, isDirectory, variant = 'default', onError, onStateChange }: LinkDropdownProps) {
  const { state, errorMsg, handleAction, resetOnClose } = useActionState(onError, onStateChange);

  const items: { label: string; type: LinkType }[] = [{ label: 'Page', type: 'page' }];
  if (showRaw) items.push({ label: 'Raw', type: 'raw' });
  if (showEvent) items.push({ label: 'Event', type: 'event' });

  return (
    <ActionDropdown
      icon={LinkIcon}
      label="Share"
      title="Copy share link"
      variant={variant}
      compact={compact}
      state={state}
      contentClass="w-52"
      onOpenChange={resetOnClose}
      errorSlot={<DropdownErrorBanner message={errorMsg} />}
    >
      {items.map((item) => (
        <DropdownMenuItem
          key={item.type}
          onSelect={() => void handleAction(() => copyShareLink(path, shareSettings, item.type, isDirectory))}
          className="cursor-pointer"
        >
          Copy {item.label} Link
        </DropdownMenuItem>
      ))}

      <DropdownMenuSeparator />

      <div className="px-2 py-1 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Expires</span>
        <select
          className="text-xs bg-popover text-popover-foreground border border-border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring min-w-0"
          value={shareSettings.expiry}
          onChange={(e) => onShareSettingsChange({ ...shareSettings, expiry: e.target.value })}
          onClick={(e) => e.stopPropagation()}
        >
          {EXPIRY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {!isDirectory && (
        <>
          <div className="px-2 py-1 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Depth</span>
            <input
              type="number"
              min={0}
              max={10}
              className="text-xs bg-popover text-popover-foreground border border-border rounded px-1 py-0.5 w-14 text-right focus:outline-none focus:ring-1 focus:ring-ring"
              value={shareSettings.depth}
              onChange={(e) => onShareSettingsChange({ ...shareSettings, depth: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="px-2 py-1 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Directories</span>
            <input
              type="checkbox"
              className="rounded border-border"
              checked={shareSettings.dirs}
              onChange={(e) => onShareSettingsChange({ ...shareSettings, dirs: e.target.checked })}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </>
      )}
    </ActionDropdown>
  );
}
