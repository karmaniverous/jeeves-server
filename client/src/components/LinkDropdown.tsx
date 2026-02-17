import { Check, Link as LinkIcon, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getShareLink, type ShareSettings } from '@/lib/api';

interface LinkDropdownProps {
  /** URL path for generating share links (with leading slash) */
  path: string;
  /** Global share settings */
  shareSettings: ShareSettings;
  /** Callback to update global share settings */
  onShareSettingsChange: (settings: ShareSettings) => void;
  /** Whether to show "Event" option (header only, not directory rows) */
  showEvent?: boolean;
  /** Whether to show "Raw" option */
  showRaw?: boolean;
  /** Small variant for directory rows */
  compact?: boolean;
  /** Color variant: 'header' for always-dark header, 'default' for theme-aware table rows */
  variant?: 'header' | 'default';
}

type LinkType = 'page' | 'raw' | 'event';

async function copyShareLink(path: string, settings: ShareSettings, type: LinkType) {
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

  const depth = settings.depth > 0 ? settings.depth : undefined;
  const dirs = settings.dirs || undefined;

  const data = await getShareLink(path, expiryParam, depth, dirs);
  if (!data.url) throw new Error('No URL returned');

  let fullUrl = window.location.origin + data.url;
  if (type === 'raw') {
    fullUrl += (fullUrl.includes('?') ? '&' : '?') + 'raw=1';
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

export function LinkDropdown({ path, shareSettings, onShareSettingsChange, showEvent, showRaw, compact, variant = 'default' }: LinkDropdownProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');

  const items: { label: string; type: LinkType }[] = [
    { label: 'Page', type: 'page' },
  ];
  if (showRaw) items.push({ label: 'Raw', type: 'raw' });
  if (showEvent) items.push({ label: 'Event', type: 'event' });

  const handleSelect = async (type: LinkType) => {
    setState('loading');
    try {
      await copyShareLink(path, shareSettings, type);
      setState('done');
      setTimeout(() => setState('idle'), 1500);
    } catch (err) {
      console.error('Share failed:', err);
      setState('idle');
    }
  };

  const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const btnSize = compact ? 'h-7 w-7' : 'h-8 w-8';

  const Icon = state === 'done' ? Check : state === 'loading' ? Loader2 : LinkIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`${btnSize} ${state === 'done' ? 'text-green-500' : variant === 'header' ? 'text-zinc-400 hover:text-white' : 'text-muted-foreground hover:text-foreground'}`}
          disabled={state === 'loading'}
          title="Copy share link"
        >
          <Icon className={`${iconSize} ${state === 'loading' ? 'animate-spin' : ''}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {/* Copy link actions */}
        {items.map((item) => (
          <DropdownMenuItem
            key={item.type}
            onSelect={() => void handleSelect(item.type)}
            className="cursor-pointer"
          >
            Copy {item.label} Link
          </DropdownMenuItem>
        ))}

        {/* Share settings */}
        <DropdownMenuSeparator />

        {/* Expires — inline */}
        <div className="px-2 py-1 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Expires</span>
          <select
            className="text-xs bg-transparent border border-border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring min-w-0"
            value={shareSettings.expiry}
            onChange={(e) => onShareSettingsChange({ ...shareSettings, expiry: e.target.value })}
            onClick={(e) => e.stopPropagation()}
          >
            {EXPIRY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Depth — inline */}
        <div className="px-2 py-1 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Depth</span>
          <input
            type="number"
            min={0}
            max={10}
            className="text-xs bg-transparent border border-border rounded px-1 py-0.5 w-14 text-right focus:outline-none focus:ring-1 focus:ring-ring"
            value={shareSettings.depth}
            onChange={(e) => onShareSettingsChange({ ...shareSettings, depth: Math.max(0, parseInt(e.target.value, 10) || 0) })}
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Dirs — inline */}
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
