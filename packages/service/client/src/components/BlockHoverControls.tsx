/**
 * Hover-activated editing controls on rendered Markdown blocks.
 * Attaches to MarkdownView rendered content via event delegation.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpToLine, Copy, Pencil, Trash2 } from 'lucide-react';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { BlockEditPopup } from '@/components/BlockEditPopup';
import type { BlockEditMode } from '@/components/BlockEditPopup';
import { blockLabel, blockLanguage } from '@/components/blockUtils';
import { fileMutate } from '@/lib/api';
import type { FileContent } from '@/lib/api';
import { useUndo } from '@/lib/useUndo';

/** Padding (px) inside the hover border highlight. */
const BORDER_PADDING = 6;
/** Height (px) of the control buttons area above the block. */
const CONTROLS_HEIGHT = 20;
/** Debounce delay (ms) before switching hovered element. */
const HOVER_DEBOUNCE_MS = 200;
/** Edge zone (px) — when the mouse is this close to the top/bottom of a parent block, prefer the parent over the child. */
const EDGE_ZONE_PX = 8;

interface BlockHoverControlsProps {
  containerRef: React.RefObject<HTMLElement | null>;
  fileRendered: FileContent;
  fileRaw: FileContent | null;
  reqPath: string;
  refetch: () => Promise<void>;
  popupOpenRef: React.MutableRefObject<boolean>;
}

/** Pre-computed overlay position (avoids ref reads during render). */
interface OverlayRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Check if a <tr> is the header row (first <tr> inside <thead>). */
function isHeaderRow(tr: Element): boolean {
  const parent = tr.parentElement;
  if (!parent || parent.tagName.toLowerCase() !== 'thead') return false;
  return parent.querySelector('tr') === tr;
}

/** Get column count from a table element's DOM. */
function getTableColumnCount(table: Element): number {
  const firstRow = table.querySelector('tr');
  if (!firstRow) return 3;
  return firstRow.querySelectorAll('th, td').length;
}

/** Extract raw lines from file content by source line range. */
function extractSourceLines(content: string, startLine: number, endLine: number): string {
  const lines = content.split(/\r?\n/);
  return lines.slice(startLine - 1, endLine).join('\n');
}

/**
 * Find the best hovered element for a mouseover target.
 * Prefers td/th cells inside a tr with source mapping.
 * When the mouse is within EDGE_ZONE_PX of a parent block's top/bottom edge,
 * prefer the parent so container blocks (ul, ol, table, blockquote) are selectable.
 */
function findHoverTarget(target: Element, clientY: number): Element | null {
  // Cell-level targeting for tables
  const cell = target.closest('td, th');
  if (cell) {
    const row = cell.closest('tr');
    if (row) {
      const table = row.closest('[data-source-start]');
      if (table) return cell;
    }
  }

  const innermost = target.closest('[data-source-start]');
  if (!innermost) return null;

  // Walk up to check if the mouse is in the edge zone of a parent block
  let parent = innermost.parentElement?.closest('[data-source-start]');
  while (parent) {
    const parentRect = parent.getBoundingClientRect();
    const distFromTop = clientY - parentRect.top;
    const distFromBottom = parentRect.bottom - clientY;
    if (distFromTop <= EDGE_ZONE_PX || distFromBottom <= EDGE_ZONE_PX) {
      return parent;
    }
    parent = parent.parentElement?.closest('[data-source-start]') ?? null;
  }

  return innermost;
}

/** Compute overlay rect relative to container, with padding. */
function computeOverlayRect(el: Element, container: HTMLElement): OverlayRect {
  const rect = el.getBoundingClientRect();
  const cRect = container.getBoundingClientRect();
  return {
    top: rect.top - cRect.top + container.scrollTop - BORDER_PADDING,
    left: rect.left - cRect.left - BORDER_PADDING,
    width: rect.width + BORDER_PADDING * 2,
    height: rect.height + BORDER_PADDING * 2,
  };
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
  const [hoveredEl, setHoveredEl] = useState<Element | null>(null);
  const [hoverRect, setHoverRect] = useState<OverlayRect | null>(null);
  const [editMode, setEditMode] = useState<BlockEditMode | null>(null);
  const [editBlockLabel, setEditBlockLabel] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ startLine: number; endLine: number } | null>(null);
  const [loadingRect, setLoadingRect] = useState<OverlayRect | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingElRef = useRef<Element | null>(null);

  // Guards: skip if matchedRules is non-empty or not insider
  const matchedRules = fileRendered.matchedRules;
  const isInsider = fileRendered.isInsider;
  const skip = !isInsider || (matchedRules && matchedRules.length > 0);

  // Source content for COPY and EDIT
  const rawContent = fileRaw?.content ?? fileRendered.content ?? '';

  // Sync popup-open ref so parent can suppress keyboard shortcuts without DOM queries
  const isPopupOpen = editMode !== null || deleteTarget !== null;
  useEffect(() => {
    popupOpenRef.current = isPopupOpen;
    return () => { popupOpenRef.current = false; };
  }, [isPopupOpen, popupOpenRef]);

  // Clear hover when content re-renders (adjusting state during render pattern)
  const [prevHtml, setPrevHtml] = useState(fileRendered.html);
  if (fileRendered.html !== prevHtml) {
    setPrevHtml(fileRendered.html);
    setHoveredEl(null);
    setHoverRect(null);
  }

  // Debounced hover setter — computes rect in the timer callback (not during render)
  const setHoveredDebounced = useCallback((el: Element | null) => {
    if (hoverTimerRef.current !== null) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    pendingElRef.current = el;
    hoverTimerRef.current = setTimeout(() => {
      hoverTimerRef.current = null;
      const pending = pendingElRef.current;
      if (!pending) {
        setHoveredEl(null);
        setHoverRect(null);
        return;
      }
      const container = containerRef.current;
      if (!container) {
        setHoveredEl(null);
        setHoverRect(null);
        return;
      }
      setHoveredEl(pending);
      setHoverRect(computeOverlayRect(pending, container));
    }, HOVER_DEBOUNCE_MS);
  }, [containerRef]);

  // Hover detection via event delegation
  useEffect(() => {
    if (skip) return;
    const container = containerRef.current;
    if (!container) return;

    function handleMouseOver(e: MouseEvent) {
      const target = e.target as Element;
      const block = findHoverTarget(target, e.clientY);
      setHoveredDebounced(block);
    }

    function handleMouseOut(e: MouseEvent) {
      const related = e.relatedTarget as Element | null;
      if (!related) { setHoveredDebounced(null); return; }
      if (controlsRef.current?.contains(related)) return;
      const container_ = containerRef.current;
      if (!container_?.contains(related)) { setHoveredDebounced(null); return; }
      const block = findHoverTarget(related, e.clientY);
      if (!block) setHoveredDebounced(null);
    }

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseout', handleMouseOut);
    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseout', handleMouseOut);
      if (hoverTimerRef.current !== null) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
    };
  }, [skip, containerRef, setHoveredDebounced]);

  const getSourceRange = useCallback((el: Element) => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'td' || tag === 'th') {
      const table = el.closest('[data-source-start]');
      if (table) {
        const start = parseInt(table.getAttribute('data-source-start') ?? '0', 10);
        const end = parseInt(table.getAttribute('data-source-end') ?? '0', 10);
        return { startLine: start, endLine: end };
      }
    }
    const start = parseInt(el.getAttribute('data-source-start') ?? '0', 10);
    const end = parseInt(el.getAttribute('data-source-end') ?? '0', 10);
    return { startLine: start, endLine: end };
  }, []);

  // --- Actions ---

  const handleCopy = useCallback(
    (el: Element) => {
      const elTag = el.tagName.toLowerCase();
      if (elTag === 'td' || elTag === 'th') {
        const text = el.textContent?.trim() ?? '';
        if (text) navigator.clipboard.writeText(text).catch(() => {});
        return;
      }
      const { startLine, endLine } = getSourceRange(el);
      if (!startLine || !endLine) return;
      const text = extractSourceLines(rawContent, startLine, endLine);
      navigator.clipboard.writeText(text).catch(() => {});
    },
    [rawContent, getSourceRange],
  );

  const handleEdit = useCallback(
    (el: Element) => {
      const tag = el.tagName.toLowerCase();

      if (tag === 'td' || tag === 'th') {
        const row = el.closest('tr');
        const table = el.closest('table');
        if (!row || !table) return;
        const { startLine: tableStart } = getSourceRange(el);
        if (!tableStart) return;

        const isHeader = row.closest('thead') !== null;
        let rowLine: number;
        if (isHeader) {
          rowLine = tableStart;
        } else {
          const tbody = row.closest('tbody');
          if (!tbody) return;
          const bodyRows = Array.from(tbody.querySelectorAll(':scope > tr'));
          const rowIndex = bodyRows.indexOf(row as HTMLTableRowElement);
          rowLine = tableStart + 2 + rowIndex;
        }

        const cells = Array.from(row.children);
        const col = cells.indexOf(el);

        setEditBlockLabel('cell');
        setEditMode({
          kind: 'edit-cell',
          line: rowLine,
          col,
          content: el.textContent?.trim() ?? '',
        });
        return;
      }

      const { startLine, endLine } = getSourceRange(el);
      if (!startLine || !endLine) return;
      const content = extractSourceLines(rawContent, startLine, endLine);
      const language = blockLanguage(el);

      setEditBlockLabel(blockLabel(el));
      setEditMode({
        kind: 'edit-block',
        startLine,
        endLine,
        content,
        language,
      });
    },
    [rawContent, getSourceRange],
  );

  const handleInsert = useCallback(
    (el: Element, position: 'before' | 'after') => {
      const { startLine, endLine } = getSourceRange(el);
      if (!startLine || !endLine) return;

      const tag = el.tagName.toLowerCase();
      const isRow = tag === 'tr';
      let content: string | undefined;
      let context: 'table-row' | undefined;

      if (isRow) {
        const table = el.closest('table');
        const colCount = table ? getTableColumnCount(table) : 3;
        content = '| ' + Array(colCount).fill(' ').join(' | ') + ' |';
        context = 'table-row';
      }

      const atLine = position === 'before' ? startLine : endLine;
      const language = blockLanguage(el.closest('table') ?? el);

      setEditBlockLabel(blockLabel(el));
      setEditMode({
        kind: 'insert-block',
        atLine,
        position,
        language,
        content,
        context,
      });
    },
    [getSourceRange],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteTarget(null);
    try {
      await fileMutate(reqPath, {
        action: 'delete-block',
        startLine: deleteTarget.startLine,
        endLine: deleteTarget.endLine,
      });
      pushUndo(reqPath, rawContent);
      setHoveredEl(null);
      setHoverRect(null);
      await refetch();
    } catch (e: unknown) {
      setErrorMsg((e as Error).message);
    }
  }, [deleteTarget, reqPath, rawContent, pushUndo, refetch]);

  const handleSaved = useCallback(async () => {
    setEditMode(null);
    // Compute loading rect from hoveredEl before clearing it
    const container = containerRef.current;
    if (hoveredEl && container) {
      setLoadingRect(computeOverlayRect(hoveredEl, container));
    }
    setHoveredEl(null);
    setHoverRect(null);
    try {
      await refetch();
    } finally {
      setLoadingRect(null);
    }
  }, [hoveredEl, refetch, containerRef]);

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

  // Determine which controls to show
  const tag = hoveredEl?.tagName.toLowerCase();
  const isCell = tag === 'td' || tag === 'th';
  const isRow = tag === 'tr';
  const isHeaderTr = isRow && hoveredEl ? isHeaderRow(hoveredEl) : false;
  const isThead = tag === 'thead';
  const isTbody = tag === 'tbody';
  const suppressControls = isThead || isTbody;

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
        <div
          ref={controlsRef}
          className="absolute pointer-events-none"
          style={{
            top: hoverRect.top - CONTROLS_HEIGHT,
            left: hoverRect.left,
            width: hoverRect.width,
            height: hoverRect.height + CONTROLS_HEIGHT,
          }}
        >
          {/* Border highlight (offset down by CONTROLS_HEIGHT to leave room for buttons) */}
          <div
            className="absolute inset-x-0 bottom-0 border-2 border-blue-400/50 rounded pointer-events-none"
            style={{ height: hoverRect.height }}
          />

          {/* Label */}
          <span
            className="absolute left-1 text-[10px] px-1 py-0.5 bg-blue-500 text-white rounded-t leading-none pointer-events-auto"
            style={{ top: CONTROLS_HEIGHT - BORDER_PADDING - 2 }}
          >
            {blockLabel(hoveredEl)}
          </span>

          {/* Control buttons */}
          <div
            className="absolute right-1 flex gap-0.5 pointer-events-auto"
            style={{ top: CONTROLS_HEIGHT - BORDER_PADDING - 2 }}
          >
            {/* EDIT (always shown) */}
            <button
              onClick={() => handleEdit(hoveredEl)}
              className="p-0.5 bg-popover border border-border rounded hover:bg-accent transition-colors"
              title="Edit"
            >
              <Pencil className="h-3 w-3 text-foreground" />
            </button>

            {/* COPY (shown for all elements including cells) */}
            <button
              onClick={() => handleCopy(hoveredEl)}
              className="p-0.5 bg-popover border border-border rounded hover:bg-accent transition-colors"
              title="Copy"
            >
              <Copy className="h-3 w-3 text-foreground" />
            </button>

            {!isCell && (
              <>
                {/* INSERT ABOVE */}
                <button
                  onClick={() => handleInsert(hoveredEl, 'before')}
                  className="p-0.5 bg-popover border border-border rounded hover:bg-accent transition-colors"
                  title="Insert above"
                >
                  <ArrowUpToLine className="h-3 w-3 text-foreground" />
                  <span className="sr-only">Insert above</span>
                </button>

                {/* INSERT BELOW (suppressed for header tr) */}
                {!(isRow && isHeaderTr) && (
                  <button
                    onClick={() => handleInsert(hoveredEl, 'after')}
                    className="p-0.5 bg-popover border border-border rounded hover:bg-accent transition-colors"
                    title="Insert below"
                  >
                    <ArrowDownToLine className="h-3 w-3 text-foreground" />
                    <span className="sr-only">Insert below</span>
                  </button>
                )}

                {/* DELETE (suppressed for header tr) */}
                {!(isRow && isHeaderTr) && (
                  <button
                    onClick={() => {
                      const range = getSourceRange(hoveredEl);
                      if (range.startLine && range.endLine) setDeleteTarget(range);
                    }}
                    className="p-0.5 bg-popover border border-border rounded hover:bg-destructive/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
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
