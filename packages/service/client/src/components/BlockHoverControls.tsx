/**
 * Hover-activated editing controls on rendered Markdown blocks.
 * Attaches to MarkdownView rendered content via event delegation.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { BlockEditPopup, blockLanguage } from '@/components/BlockEditPopup';
import type { BlockEditMode } from '@/components/BlockEditPopup';
import { fileMutate } from '@/lib/api';
import type { FileContent } from '@/lib/api';

interface BlockHoverControlsProps {
  containerRef: React.RefObject<HTMLElement | null>;
  fileRendered: FileContent;
  fileRaw: FileContent | null;
  reqPath: string;
  refetch: () => Promise<void>;
}

/** Block type label for the hover indicator. */
function blockLabel(el: Element): string {
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case 'p': return 'paragraph';
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': return 'heading';
    case 'li': return 'list item';
    case 'blockquote': return 'blockquote';
    case 'table': return 'table';
    case 'tr': return 'row';
    case 'td': case 'th': return 'cell';
    case 'pre': return 'code';
    case 'hr': return 'hr';
    case 'ul': case 'ol': return 'list';
    default:
      if (el.classList.contains('embedded-diagram-lazy')) return 'diagram';
      return tag;
  }
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
  // startLine and endLine are 1-indexed inclusive
  return lines.slice(startLine - 1, endLine).join('\n');
}

export function BlockHoverControls({
  containerRef,
  fileRendered,
  fileRaw,
  reqPath,
  refetch,
}: BlockHoverControlsProps) {
  const [hoveredEl, setHoveredEl] = useState<Element | null>(null);
  const [editMode, setEditMode] = useState<BlockEditMode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ startLine: number; endLine: number } | null>(null);
  const [loadingBlock, setLoadingBlock] = useState<Element | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);

  // Guards: skip if matchedRules is non-empty or not insider
  const matchedRules = fileRendered.matchedRules;
  const isInsider = fileRendered.isInsider;
  const skip = !isInsider || (matchedRules && matchedRules.length > 0);

  // Source content for COPY and EDIT
  const rawContent = fileRaw?.content ?? fileRendered.content ?? '';

  // Hover detection via event delegation
  useEffect(() => {
    if (skip) return;
    const container = containerRef.current;
    if (!container) return;

    function handleMouseOver(e: MouseEvent) {
      const target = e.target as Element;
      const block = target.closest('[data-source-start]');
      setHoveredEl(block);
    }

    function handleMouseOut(e: MouseEvent) {
      const related = e.relatedTarget as Element | null;
      if (!related) { setHoveredEl(null); return; }
      // Don't un-hover if moving to controls overlay
      if (controlsRef.current?.contains(related)) return;
      const container_ = containerRef.current;
      if (!container_?.contains(related)) { setHoveredEl(null); return; }
      const block = related.closest('[data-source-start]');
      if (!block) setHoveredEl(null);
    }

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseout', handleMouseOut);
    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseout', handleMouseOut);
    };
  }, [skip, containerRef]);

  // Clear hover when content re-renders
  useEffect(() => {
    setHoveredEl(null);
  }, [fileRendered.html]);

  const getSourceRange = useCallback((el: Element) => {
    const start = parseInt(el.getAttribute('data-source-start') ?? '0', 10);
    const end = parseInt(el.getAttribute('data-source-end') ?? '0', 10);
    return { startLine: start, endLine: end };
  }, []);

  // --- Actions ---

  const handleCopy = useCallback(
    (el: Element) => {
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

      // Cell editing
      if (tag === 'td' || tag === 'th') {
        const row = el.closest('tr');
        const table = el.closest('table');
        if (!row || !table) return;
        const { startLine: tableStart } = getSourceRange(table);
        if (!tableStart) return;

        // Determine row line
        const isHeader = row.closest('thead') !== null;
        let rowLine: number;
        if (isHeader) {
          rowLine = tableStart;
        } else {
          const tbody = row.closest('tbody');
          if (!tbody) return;
          const bodyRows = Array.from(tbody.querySelectorAll(':scope > tr'));
          const rowIndex = bodyRows.indexOf(row as HTMLTableRowElement);
          rowLine = tableStart + 2 + rowIndex; // header + separator + index
        }

        // Determine col
        const cells = Array.from(row.children);
        const col = cells.indexOf(el);

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
      setHoveredEl(null);
      await refetch();
    } catch (e: unknown) {
      setErrorMsg((e as Error).message);
    }
  }, [deleteTarget, reqPath, refetch]);

  const handleSaved = useCallback(async () => {
    setEditMode(null);
    setLoadingBlock(hoveredEl);
    setHoveredEl(null);
    try {
      await refetch();
    } finally {
      setLoadingBlock(null);
    }
  }, [hoveredEl, refetch]);

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
      {loadingBlock && (() => {
        const rect = loadingBlock.getBoundingClientRect();
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect) return null;
        return (
          <div
            className="absolute pointer-events-none rounded bg-blue-500/10 animate-pulse"
            style={{
              top: rect.top - containerRect.top + (containerRef.current?.scrollTop ?? 0),
              left: rect.left - containerRect.left,
              width: rect.width,
              height: rect.height,
            }}
          />
        );
      })()}

      {/* Hover controls */}
      {hoveredEl && !suppressControls && (() => {
        const rect = hoveredEl.getBoundingClientRect();
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect) return null;

        const top = rect.top - containerRect.top + (containerRef.current?.scrollTop ?? 0);
        const left = rect.left - containerRect.left;

        return (
          <div
            ref={controlsRef}
            className="absolute pointer-events-none"
            style={{ top, left, width: rect.width, height: rect.height }}
          >
            {/* Border highlight */}
            <div className="absolute inset-0 border-2 border-blue-400/50 rounded pointer-events-none" />

            {/* Label */}
            <span className="absolute -top-5 left-1 text-[10px] px-1 py-0.5 bg-blue-500 text-white rounded-t leading-none pointer-events-auto">
              {blockLabel(hoveredEl)}
            </span>

            {/* Control buttons */}
            <div className="absolute -top-5 right-1 flex gap-0.5 pointer-events-auto">
              {/* EDIT (always shown) */}
              <button
                onClick={() => handleEdit(hoveredEl)}
                className="p-0.5 bg-popover border border-border rounded hover:bg-accent transition-colors"
                title="Edit"
              >
                <Pencil className="h-3 w-3 text-foreground" />
              </button>

              {/* Cell-only: just EDIT */}
              {!isCell && (
                <>
                  {/* COPY */}
                  <button
                    onClick={() => handleCopy(hoveredEl)}
                    className="p-0.5 bg-popover border border-border rounded hover:bg-accent transition-colors"
                    title="Copy"
                  >
                    <Copy className="h-3 w-3 text-foreground" />
                  </button>

                  {/* INSERT ABOVE */}
                  <button
                    onClick={() => handleInsert(hoveredEl, 'before')}
                    className="p-0.5 bg-popover border border-border rounded hover:bg-accent transition-colors"
                    title="Insert above"
                  >
                    <Plus className="h-3 w-3 text-foreground" />
                    <span className="sr-only">Insert above</span>
                  </button>

                  {/* INSERT BELOW (suppressed for header tr) */}
                  {!(isRow && isHeaderTr) && (
                    <button
                      onClick={() => handleInsert(hoveredEl, 'after')}
                      className="p-0.5 bg-popover border border-border rounded hover:bg-accent transition-colors"
                      title="Insert below"
                    >
                      <Plus className="h-3 w-3 text-foreground rotate-180" />
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
        );
      })()}

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
