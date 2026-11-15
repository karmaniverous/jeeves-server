/**
 * Hover-activated editing controls on rendered Markdown blocks.
 * Attaches to MarkdownView rendered content via event delegation.
 */
import { useCallback, useEffect, useState } from 'react';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { BlockEditPopup } from '@/components/BlockEditPopup';
import type { BlockEditMode } from '@/components/BlockEditPopup';
import {
  type BlockEdit,
  computeOverlayRect,
  copyTextOf,
  editFor,
  insertFor,
  type OverlayRect,
  type SourceRange,
  sourceRangeOf,
} from '@/components/blockHoverDom';
import { BlockHoverToolbar } from '@/components/BlockHoverToolbar';
import { useBlockHover } from '@/hooks/useBlockHover';
import type { FileContent } from '@/lib/apiTypes';
import { errorMessage } from '@/lib/serverErrors';
import { server } from '@/lib/server';
import { useUndo } from '@/lib/useUndo';

interface BlockHoverControlsProps {
  containerRef: React.RefObject<HTMLElement | null>;
  fileRendered: FileContent;
  fileRaw: FileContent | null;
  reqPath: string;
  refetch: () => Promise<void>;
  popupOpenRef: React.MutableRefObject<boolean>;
}

export function BlockHoverControls({
  containerRef,
  fileRendered,
  fileRaw,
  reqPath,
  refetch,
  popupOpenRef,
}: BlockHoverControlsProps) {
  const { pushUndo } = useUndo();
  const [editMode, setEditMode] = useState<BlockEditMode | null>(null);
  const [editBlockLabel, setEditBlockLabel] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SourceRange | null>(null);
  const [loadingRect, setLoadingRect] = useState<OverlayRect | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Guards: skip if matchedRules is non-empty or not insider
  const matchedRules = fileRendered.matchedRules;
  const isInsider = fileRendered.isInsider;
  const skip = !isInsider || (matchedRules && matchedRules.length > 0);

  const { hoveredEl, hoverRect, controlsRef, clearHover } = useBlockHover(
    containerRef,
    fileRendered.html,
    !!skip,
  );

  // Source content for COPY and EDIT
  const rawContent = fileRaw?.content ?? fileRendered.content ?? '';

  // Sync popup-open ref so parent can suppress keyboard shortcuts without DOM queries
  const isPopupOpen = editMode !== null || deleteTarget !== null;
  useEffect(() => {
    popupOpenRef.current = isPopupOpen;
    return () => {
      popupOpenRef.current = false;
    };
  }, [isPopupOpen, popupOpenRef]);

  // --- Actions ---

  const handleCopy = useCallback(
    (el: Element) => {
      const text = copyTextOf(el, rawContent);
      if (text !== null && navigator.clipboard)
        navigator.clipboard.writeText(text).catch(() => {});
    },
    [rawContent],
  );

  /** Open the popup on an edit, if there is one. */
  const openEdit = useCallback((edit: BlockEdit | null) => {
    if (!edit) return;
    setEditBlockLabel(edit.label);
    setEditMode(edit.mode);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteTarget(null);
    try {
      await server.fileMutate({
        '*': reqPath,
        action: 'delete-block',
        startLine: deleteTarget.startLine,
        endLine: deleteTarget.endLine,
      });
      pushUndo(reqPath, rawContent);
      clearHover();
      await refetch();
    } catch (e: unknown) {
      setErrorMsg(errorMessage(e));
    }
  }, [deleteTarget, reqPath, rawContent, pushUndo, refetch, clearHover]);

  const handleSaved = useCallback(async () => {
    setEditMode(null);
    // Compute loading rect from hoveredEl before clearing it
    const container = containerRef.current;
    if (hoveredEl && container) {
      setLoadingRect(computeOverlayRect(hoveredEl, container));
    }
    clearHover();
    try {
      await refetch();
    } finally {
      setLoadingRect(null);
    }
  }, [hoveredEl, refetch, containerRef, clearHover]);

  const handleSaveError = useCallback((msg: string) => {
    setEditMode(null);
    setErrorMsg(msg);
  }, []);

  // Clear error after 5 seconds
  useEffect(() => {
    if (!errorMsg) return;
    const timer = setTimeout(() => setErrorMsg(null), 5000);
    return () => clearTimeout(timer);
  }, [errorMsg]);

  if (skip) return null;

  // No controls on a whole table head or body
  const tag = hoveredEl?.tagName.toLowerCase();
  const suppressControls = tag === 'thead' || tag === 'tbody';

  return (
    <>
      {/* Loading shimmer on block */}
      {loadingRect && (
        <div
          className="absolute pointer-events-none rounded bg-blue-500/10 animate-pulse"
          style={{
            top: loadingRect.top,
            left: loadingRect.left,
            width: loadingRect.width,
            height: loadingRect.height,
          }}
        />
      )}

      {/* Hover controls */}
      {hoveredEl && !suppressControls && hoverRect && (
        <BlockHoverToolbar
          hoveredEl={hoveredEl}
          hoverRect={hoverRect}
          controlsRef={controlsRef}
          onEdit={() => openEdit(editFor(hoveredEl, rawContent))}
          onCopy={() => handleCopy(hoveredEl)}
          onInsert={(position) => openEdit(insertFor(hoveredEl, position))}
          onDelete={() => {
            const range = sourceRangeOf(hoveredEl);
            if (range.startLine && range.endLine) setDeleteTarget(range);
          }}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Block"
        description="Are you sure you want to delete this block? This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
      />

      {/* Edit popup */}
      {editMode && (
        <BlockEditPopup
          mode={editMode}
          reqPath={reqPath}
          blockLabel={editBlockLabel}
          fileContent={rawContent}
          onClose={() => setEditMode(null)}
          onSaved={handleSaved}
          onError={handleSaveError}
        />
      )}

      {/* Error toast */}
      {errorMsg && (
        <div className="fixed bottom-4 right-4 z-[200] bg-destructive text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          {errorMsg}
        </div>
      )}
    </>
  );
}
