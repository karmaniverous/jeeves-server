import { CloudDownload } from 'lucide-react';

import {
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  ActionDropdown,
  DropdownErrorBanner,
  type ActionState,
} from '@/components/ActionDropdown';
import { useActionState } from '@/components/useActionState';
import { clearCache, withKey } from '@/lib/api';
import { useAuthStatus } from '@/lib/AuthStatusContext';
import { getDownloadItems, showClearCache } from '@/lib/downloadItems';

interface DownloadDropdownProps {
  reqPath: string;
  file: { fileName: string; type: string } | null;
  isDirectory?: boolean;
  compact?: boolean;
  variant?: 'header' | 'default' | 'menuItem';
  onError?: (error: string) => void;
  onStateChange?: (state: ActionState) => void;
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

export function DownloadDropdown({
  reqPath,
  file,
  isDirectory,
  compact,
  variant = 'default',
  onError,
  onStateChange,
}: DownloadDropdownProps) {
  const { state, errorMsg, handleAction, resetOnClose } = useActionState(
    (msg) => {
      onError?.(msg);
      alert(`Download failed: ${msg}`);
    },
    onStateChange,
  );
  const { isInsider } = useAuthStatus();
  const items = getDownloadItems(reqPath, file, isDirectory, isInsider);

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
          onSelect={() =>
            void handleAction(() => downloadBlob(item.href, item.filename))
          }
          className="cursor-pointer"
        >
          {item.label}
        </DropdownMenuItem>
      ))}
      {showClearCache(isDirectory, isInsider) && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() =>
              void handleAction(async () => {
                await clearCache(reqPath);
              })
            }
            className="cursor-pointer text-muted-foreground"
          >
            Clear Cache
          </DropdownMenuItem>
        </>
      )}
    </ActionDropdown>
  );
}
