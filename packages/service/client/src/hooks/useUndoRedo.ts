/**
 * Undo and redo of a file's content: write the stored version back through the API, record the current content on the other stack, reload. One implementation for the header buttons and the Ctrl+Z shortcuts.
 */
import { useCallback, useState } from 'react';

import { server } from '@/lib/server';
import { useUndo } from '@/lib/useUndo';

/**
 * Undo/redo handlers for a file.
 *
 * @param reqPath - The file's browse path.
 * @param currentContent - Its content now (pushed on the other stack).
 * @param refetch - Reload the file after a write.
 * @returns The handlers, whether a write is in flight, and whether undo or
 *   redo is available.
 */
export function useUndoRedo(
  reqPath: string,
  currentContent: string,
  refetch: () => Promise<void>,
) {
  const { peekUndo, peekRedo, confirmUndo, confirmRedo, canUndo, canRedo } =
    useUndo();
  const [saving, setSaving] = useState(false);

  const restore = useCallback(
    async (
      peek: (path: string) => string | undefined,
      confirm: (path: string, content: string) => void,
    ) => {
      const restored = peek(reqPath);
      if (!restored) return;
      setSaving(true);
      try {
        await server.fileWrite({ '*': reqPath, content: restored });
        confirm(reqPath, currentContent);
        await refetch();
      } finally {
        setSaving(false);
      }
    },
    [reqPath, currentContent, refetch],
  );

  const handleUndo = useCallback(
    () => restore(peekUndo, confirmUndo),
    [restore, peekUndo, confirmUndo],
  );
  const handleRedo = useCallback(
    () => restore(peekRedo, confirmRedo),
    [restore, peekRedo, confirmRedo],
  );

  return {
    handleUndo,
    handleRedo,
    saving,
    canUndo: canUndo(reqPath),
    canRedo: canRedo(reqPath),
  };
}
