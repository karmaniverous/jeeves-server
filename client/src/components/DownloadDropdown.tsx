import { Check, CloudDownload, Loader2, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DownloadDropdownProps {
  /** Current file path (relative, no leading slash) */
  reqPath: string;
  /** File info — null means we're on a directory */
  file: { fileName: string; type: string } | null;
  /** Is this a directory? */
  isDirectory?: boolean;
  /** Small variant for directory rows */
  compact?: boolean;
  /** Render variant */
  variant?: 'header' | 'default' | 'menuItem';
  /** Error callback */
  onError?: (error: string) => void;
  /** State change callback */
  onStateChange?: (state: 'idle' | 'loading' | 'done' | 'error') => void;
}

interface DownloadItem {
  label: string;
  href: string;
  filename: string;
}

function getDownloadItems(reqPath: string, file: { fileName: string; type: string } | null, isDirectory?: boolean): DownloadItem[] {
  const items: DownloadItem[] = [];

  if (isDirectory || !file) {
    items.push({ label: 'ZIP', href: `/api/export/${reqPath}?format=zip`, filename: `${reqPath.split('/').pop() ?? 'archive'}.zip` });
    return items;
  }

  const baseName = file.fileName.replace(/\.[^.]+$/, '');
  items.push({ label: 'Raw', href: `/api/raw/${reqPath}`, filename: file.fileName });

  if (file.type === 'markdown' || file.type === '.md') {
    items.push({ label: 'PDF', href: `/api/export/${reqPath}?format=pdf`, filename: `${baseName}.pdf` });
    items.push({ label: 'DOCX', href: `/api/export/${reqPath}?format=docx`, filename: `${baseName}.docx` });
  }

  if (file.type === 'mermaid' || file.type === '.mmd') {
    items.push({ label: 'SVG', href: `/api/mermaid-export/${reqPath}?format=svg`, filename: `${baseName}.svg` });
    items.push({ label: 'PNG', href: `/api/mermaid-export/${reqPath}?format=png`, filename: `${baseName}.png` });
  }

  return items;
}

async function downloadBlob(href: string, filename: string) {
  const res = await fetch(href, { credentials: 'include' });
  if (!res.ok) throw new Error(`Download failed (${String(res.status)})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function DownloadDropdown({ reqPath, file, isDirectory, compact, variant = 'default', onError, onStateChange }: DownloadDropdownProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const items = getDownloadItems(reqPath, file, isDirectory);

  if (items.length === 0) return null;

  const updateState = (s: 'idle' | 'loading' | 'done' | 'error') => {
    setState(s);
    onStateChange?.(s);
  };

  const handleSelect = async (item: DownloadItem) => {
    updateState('loading');
    setErrorMsg(null);
    try {
      await downloadBlob(item.href, item.filename);
      updateState('done');
      setTimeout(() => updateState('idle'), 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      setErrorMsg(msg);
      updateState('error');
      onError?.(msg);
    }
  };

  const isMenuItem = variant === 'menuItem';
  const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const btnSize = compact ? 'h-7 w-7' : 'h-8 w-8';

  const Icon = state === 'done' ? Check : state === 'error' ? X : state === 'loading' ? Loader2 : CloudDownload;
  const iconColor = state === 'done' ? 'text-green-500' : state === 'error' ? 'text-red-500' : '';

  const trigger = isMenuItem ? (
    <button
      className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors w-full text-left"
      disabled={state === 'loading'}
    >
      <Icon className={`h-4 w-4 shrink-0 ${iconColor} ${state === 'loading' ? 'animate-spin' : ''}`} />
      Download
    </button>
  ) : (
    <Button
      variant="ghost"
      size="icon"
      className={`${btnSize} ${iconColor || (variant === 'header' ? 'text-zinc-300 hover:text-white hover:bg-white/10' : 'text-muted-foreground hover:text-foreground')}`}
      disabled={state === 'loading'}
      title="Download"
    >
      <Icon className={`${iconSize} ${state === 'loading' ? 'animate-spin' : ''}`} />
    </Button>
  );

  return (
    <DropdownMenu onOpenChange={(open) => { if (!open && state === 'error') { updateState('idle'); setErrorMsg(null); } }}>
      <DropdownMenuTrigger asChild>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {errorMsg && (
          <div className="px-2 py-1.5 text-xs text-red-500 bg-red-500/10 rounded mx-1 mb-1">
            {errorMsg}
          </div>
        )}
        {items.map((item) => (
          <DropdownMenuItem
            key={item.label}
            onSelect={() => void handleSelect(item)}
            className="cursor-pointer"
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
