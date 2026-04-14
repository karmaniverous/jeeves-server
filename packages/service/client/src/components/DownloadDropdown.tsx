import { CloudDownload } from 'lucide-react';

import { DropdownMenuSeparator, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { ActionDropdown, DropdownErrorBanner, type ActionState } from '@/components/ActionDropdown';
import { useActionState } from '@/components/useActionState';
import { clearCache, withKey } from '@/lib/api';

interface DownloadDropdownProps {
  reqPath: string;
  file: { fileName: string; type: string } | null;
  isDirectory?: boolean;
  compact?: boolean;
  variant?: 'header' | 'default' | 'menuItem';
  onError?: (error: string) => void;
  onStateChange?: (state: ActionState) => void;
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
    items.push({ label: 'PDF', href: `/api/mermaid-export/${reqPath}?format=pdf`, filename: `${baseName}.pdf` });
  }

  if (file.type === 'plantuml' || ['.puml', '.plantuml', '.pu'].includes(file.type)) {
    items.push({ label: 'SVG', href: `/api/plantuml-export/${reqPath}?format=svg`, filename: `${baseName}.svg` });
    items.push({ label: 'PNG', href: `/api/plantuml-export/${reqPath}?format=png`, filename: `${baseName}.png` });
    items.push({ label: 'PDF', href: `/api/plantuml-export/${reqPath}?format=pdf`, filename: `${baseName}.pdf` });
    items.push({ label: 'EPS', href: `/api/plantuml-export/${reqPath}?format=eps`, filename: `${baseName}.eps` });
  }

  return items;
}

async function downloadBlob(href: string, filename: string) {
  const res = await fetch(withKey(href), { credentials: 'include' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `Download failed (${String(res.status)})`);
  }
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
  const { state, errorMsg, handleAction, resetOnClose } = useActionState(
    (msg) => { onError?.(msg); alert(`Download failed: ${msg}`); },
    onStateChange,
  );
  const items = getDownloadItems(reqPath, file, isDirectory);

  if (items.length === 0) return null;

  return (
    <ActionDropdown
      icon={CloudDownload}
      label="Download"
      title="Download"
      variant={variant}
      compact={compact}
      state={state}
      onOpenChange={resetOnClose}
      errorSlot={<DropdownErrorBanner message={errorMsg} />}
    >
      {items.map((item) => (
        <DropdownMenuItem
          key={item.label}
          onSelect={() => void handleAction(() => downloadBlob(item.href, item.filename))}
          className="cursor-pointer"
        >
          {item.label}
        </DropdownMenuItem>
      ))}
      {!isDirectory && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => void handleAction(async () => { await clearCache(reqPath); })}
            className="cursor-pointer text-muted-foreground"
          >
            Clear Cache
          </DropdownMenuItem>
        </>
      )}
    </ActionDropdown>
  );
}
