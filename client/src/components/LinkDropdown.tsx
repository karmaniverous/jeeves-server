import { Check, Link as LinkIcon, Loader2, X } from 'lucide-react';
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
  /** Whether this is a directory share (hides depth/dirs controls) */
  isDirectory?: boolean;
  /** Render variant */
  variant?: 'header' | 'default' | 'menuItem';
  /** Error callback (for parent to show error UI) */
  onError?: (error: string) => void;
  /** Called when state changes (for parent menu auto-close control) */
  onStateChange?: (state: 'idle' | 'loading' | 'done' | 'error') => void;
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

  // Directory shares are inherently descendant-scoped — no depth/dirs needed
  const depth = !isDirectory && settings.depth > 0 ? settings.depth : undefined;
  const dirs = !isDirectory && settings.dirs ? true : undefined;

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

export function LinkDropdown({ path, shareSettings, onShareSettingsChange, showEvent, showRaw, compact, isDirectory, variant = 'default', onError, onStateChange }: LinkDropdownProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const items: { label: string; type: LinkType }[] = [
    { label: 'Page', type: 'page' },
  ];
  if (showRaw) items.push({ label: 'Raw', type: 'raw' });
  if (showEvent) items.push({ label: 'Event', type: 'event' });

  const updateState = (s: 'idle' | 'loading' | 'done' | 'error') => {
    setState(s);
    onStateChange?.(s);
  };

  const handleSelect = async (type: LinkType) => {
    updateState('loading');
    setErrorMsg(null);
    try {
      await copyShareLink(path, shareSettings, type, isDirectory);
      updateState('done');
      setTimeout(() => updateState('idle'), 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Share failed';
      setErrorMsg(msg);
      updateState('error');
      onError?.(msg);
    }
  };

  const isMenuItem = variant === 'menuItem';
  const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const btnSize = compact ? 'h-7 w-7' : 'h-8 w-8';

  const Icon = state === 'done' ? Check : state === 'error' ? X : state === 'loading' ? Loader2 : LinkIcon;
  const iconColor = state === 'done' ? 'text-green-500' : state === 'error' ? 'text-red-500' : '';

  const trigger = isMenuItem ? (
    <button
      className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors w-full text-left"
      disabled={state === 'loading'}
    >
      <Icon className={`h-4 w-4 shrink-0 ${iconColor} ${state === 'loading' ? 'animate-spin' : ''}`} />
      Share
    </button>
  ) : (
    <Button
      variant="ghost"
      size="icon"
      className={`${btnSize} ${iconColor || (variant === 'header' ? 'text-zinc-300 hover:text-white hover:bg-white/10' : 'text-muted-foreground hover:text-foreground')}`}
      disabled={state === 'loading'}
      title="Copy share link"
    >
      <Icon className={`${iconSize} ${state === 'loading' ? 'animate-spin' : ''}`} />
    </Button>
  );

  return (
    <DropdownMenu onOpenChange={(open) => { if (!open && state === 'error') { updateState('idle'); setErrorMsg(null); } }}>
      <DropdownMenuTrigger asChild>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {/* Error message */}
        {errorMsg && (
          <>
            <div className="px-2 py-1.5 text-xs text-red-500 bg-red-500/10 rounded mx-1 mb-1">
              {errorMsg}
            </div>
            <DropdownMenuSeparator />
          </>
        )}

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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
