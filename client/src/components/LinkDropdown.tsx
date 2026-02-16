import { Check, Link as LinkIcon, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getShareLink } from '@/lib/api';

interface LinkDropdownProps {
  /** URL path for generating share links (with leading slash) */
  path: string;
  /** Expiry setting from parent */
  expiry: string;
  /** Whether to show "Event" option (header only, not directory rows) */
  showEvent?: boolean;
  /** Whether to show "Raw" option */
  showRaw?: boolean;
  /** Small variant for directory rows */
  compact?: boolean;
}

type LinkType = 'page' | 'raw' | 'event';

async function copyShareLink(path: string, expiry: string, type: LinkType) {
  let expiryParam: string | undefined;
  if (expiry) {
    const match = expiry.match(/^(\d+)([hdw])$/i);
    if (match) {
      const val = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      const multiplier: Record<string, number> = { h: 3_600_000, d: 86_400_000, w: 604_800_000 };
      expiryParam = String(Date.now() + val * multiplier[unit]);
    }
  }

  const data = await getShareLink(path, expiryParam);
  if (!data.url) throw new Error('No URL returned');

  let fullUrl = window.location.origin + data.url;
  if (type === 'raw') {
    fullUrl += (fullUrl.includes('?') ? '&' : '?') + 'raw=1';
  } else if (type === 'event') {
    fullUrl = window.location.origin + '/event?key=' + data.url.split('key=')[1];
  }
  await navigator.clipboard.writeText(fullUrl);
}

export function LinkDropdown({ path, expiry, showEvent, showRaw, compact }: LinkDropdownProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');

  const items: { label: string; type: LinkType }[] = [
    { label: 'Page', type: 'page' },
  ];
  if (showRaw) items.push({ label: 'Raw', type: 'raw' });
  if (showEvent) items.push({ label: 'Event', type: 'event' });

  const handleSelect = async (type: LinkType) => {
    setState('loading');
    try {
      await copyShareLink(path, expiry, type);
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
          className={`${btnSize} ${state === 'done' ? 'text-green-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          disabled={state === 'loading'}
          title="Copy share link"
        >
          <Icon className={`${iconSize} ${state === 'loading' ? 'animate-spin' : ''}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.type}
            onSelect={() => void handleSelect(item.type)}
            className="cursor-pointer"
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
