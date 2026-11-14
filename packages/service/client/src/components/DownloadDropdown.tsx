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
import { useAuthStatus } from '@/lib/AuthStatusContext';
import { getDownloadItems, showClearCache } from '@/lib/downloadItems';
import { download } from '@/lib/downloads';
import { client, server } from '@/lib/server';

interface DownloadDropdownProps {
  reqPath: string;
  file: { fileName: string; type: string } | null;
  isDirectory?: boolean;
  compact?: boolean;
  variant?: 'header' | 'default' | 'menuItem';
  onError?: (error: string) => void;
  onStateChange?: (state: ActionState) => void;
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
            void handleAction(() => download(client, reqPath, item))
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
                await server.exportCacheClear({ '*': reqPath });
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
