import { Check, CloudDownload, Loader2 } from 'lucide-react';
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
  /** Color variant: 'header' for always-dark header, 'default' for theme-aware table rows */
  variant?: 'header' | 'default';
}

interface DownloadItem {
  label: string;
  href: string;
  filename: string;
}

function getDownloadItems(reqPath: string, file: { fileName: string; type: string } | null, isDirectory?: boolean): DownloadItem[] {
  const items: DownloadItem[] = [];

  if (isDirectory || !file) {
    // Directory: ZIP only
    items.push({ label: 'ZIP', href: `/api/export/${reqPath}?format=zip`, filename: `${reqPath.split('/').pop() ?? 'archive'}.zip` });
    return items;
  }

  const baseName = file.fileName.replace(/\.[^.]+$/, '');

  // Raw is always available for files
  items.push({ label: 'Raw', href: `/api/raw/${reqPath}`, filename: file.fileName });

  // Markdown exports
  if (file.type === 'markdown' || file.type === '.md') {
    items.push({ label: 'PDF', href: `/api/export/${reqPath}?format=pdf`, filename: `${baseName}.pdf` });
    items.push({ label: 'DOCX', href: `/api/export/${reqPath}?format=docx`, filename: `${baseName}.docx` });
  }

  // Mermaid exports
  if (file.type === 'mermaid' || file.type === '.mmd') {
    items.push({ label: 'SVG', href: `/api/mermaid-export/${reqPath}?format=svg`, filename: `${baseName}.svg` });
    items.push({ label: 'PNG', href: `/api/mermaid-export/${reqPath}?format=png`, filename: `${baseName}.png` });
  }

  return items;
}

async function downloadBlob(href: string, filename: string) {
  const res = await fetch(href, { credentials: 'include' });
  if (!res.ok) throw new Error('Download failed');
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

export function DownloadDropdown({ reqPath, file, isDirectory, compact, variant = 'default' }: DownloadDropdownProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const items = getDownloadItems(reqPath, file, isDirectory);

  if (items.length === 0) return null;

  const handleSelect = async (item: DownloadItem) => {
    setState('loading');
    try {
      await downloadBlob(item.href, item.filename);
      setState('done');
      setTimeout(() => setState('idle'), 1500);
    } catch {
      setState('idle');
    }
  };

  const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const btnSize = compact ? 'h-7 w-7' : undefined;

  const Icon = state === 'done' ? Check : state === 'loading' ? Loader2 : CloudDownload;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`${btnSize ? btnSize : 'h-8 w-8'} ${state === 'done' ? 'text-green-500' : variant === 'header' ? 'text-zinc-400 hover:text-white' : 'text-muted-foreground hover:text-foreground'}`}
          disabled={state === 'loading'}
          title="Download"
        >
          <Icon className={`${iconSize} ${state === 'loading' ? 'animate-spin' : ''}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
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
