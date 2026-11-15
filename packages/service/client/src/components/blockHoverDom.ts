/**
 * DOM helpers of the block hover controls: which rendered element a pointer is over, its overlay rectangle, its source line range, and the edit or insert a control opens for it. Pure apart from reading the DOM.
 */
import type { BlockEditMode } from '@/components/BlockEditPopup';
import { blockLabel, blockLanguage } from '@/components/blockUtils';

/** Padding (px) inside the hover border highlight. */
export const BORDER_PADDING = 6;
/** Height (px) of the control buttons area above the block. */
export const CONTROLS_HEIGHT = 20;
/** Edge zone (px) — when the mouse is this close to the top/bottom of a parent block, prefer the parent over the child. */
const EDGE_ZONE_PX = 8;

/** Pre-computed overlay position (avoids ref reads during render). */
export interface OverlayRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** A source line range (1-based, inclusive). */
export interface SourceRange {
  startLine: number;
  endLine: number;
}

/** An edit the popup opens, with the label it shows. */
export interface BlockEdit {
  label: string;
  mode: BlockEditMode;
}

/** True for a table cell element. */
export function isCell(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  return tag === 'td' || tag === 'th';
}

/** Check if a <tr> is the header row (first <tr> inside <thead>). */
export function isHeaderRow(tr: Element): boolean {
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
export function extractSourceLines(
  content: string,
  startLine: number,
  endLine: number,
): string {
  const lines = content.split(/\r?\n/);
  return lines.slice(startLine - 1, endLine).join('\n');
}

/**
 * Find the best hovered element for a mouseover target.
 * Prefers td/th cells inside a tr with source mapping.
 * When the mouse is within EDGE_ZONE_PX of a parent block's top/bottom edge,
 * prefer the parent so container blocks (ul, ol, table, blockquote) are selectable.
 */
export function findHoverTarget(
  target: Element,
  clientY: number,
): Element | null {
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
export function computeOverlayRect(
  el: Element,
  container: HTMLElement,
): OverlayRect {
  const rect = el.getBoundingClientRect();
  const cRect = container.getBoundingClientRect();
  return {
    top: rect.top - cRect.top + container.scrollTop - BORDER_PADDING,
    left: rect.left - cRect.left - BORDER_PADDING,
    width: rect.width + BORDER_PADDING * 2,
    height: rect.height + BORDER_PADDING * 2,
  };
}

/** A line-number attribute of `el` (0 when absent). */
const lineAttr = (el: Element, name: string): number =>
  parseInt(el.getAttribute(name) ?? '0', 10);

/**
 * The source line range of an element: its own `data-source-*` attributes,
 * or its table's for a cell. Zero lines when unmapped.
 */
export function sourceRangeOf(el: Element): SourceRange {
  if (isCell(el)) {
    const table = el.closest('table[data-source-start]');
    if (table)
      return {
        startLine: lineAttr(table, 'data-source-start'),
        endLine: lineAttr(table, 'data-source-end'),
      };
  }
  return {
    startLine: lineAttr(el, 'data-source-start'),
    endLine: lineAttr(el, 'data-source-end'),
  };
}

/** The cell edit of a table cell: its row's source line and column. */
function cellEdit(el: Element): BlockEdit | null {
  const row = el.closest('tr');
  const table = el.closest('table');
  if (!row || !table) return null;
  const tableStart = lineAttr(table, 'data-source-start');
  if (!tableStart) return null;

  const isHeader = row.closest('thead') !== null;
  let rowLine: number;
  if (isHeader) {
    rowLine = tableStart;
  } else {
    const tbody = row.closest('tbody');
    if (!tbody) return null;
    const bodyRows = Array.from(tbody.querySelectorAll(':scope > tr'));
    const rowIndex = bodyRows.indexOf(row as HTMLTableRowElement);
    rowLine = tableStart + 2 + rowIndex;
  }

  const cells = Array.from(row.children);
  const col = cells.indexOf(el);
  return {
    label: 'cell',
    mode: {
      kind: 'edit-cell',
      line: rowLine,
      col,
      content: el.textContent?.trim() ?? '',
    },
  };
}

/**
 * The edit the Edit control opens: a cell edit for a table cell, else a
 * block edit of the element's source lines. `null` when unmapped.
 *
 * @param el - The hovered element.
 * @param rawContent - The file's source.
 */
export function editFor(el: Element, rawContent: string): BlockEdit | null {
  if (isCell(el)) return cellEdit(el);
  const { startLine, endLine } = sourceRangeOf(el);
  if (!startLine || !endLine) return null;
  return {
    label: blockLabel(el),
    mode: {
      kind: 'edit-block',
      startLine,
      endLine,
      content: extractSourceLines(rawContent, startLine, endLine),
      language: blockLanguage(el),
    },
  };
}

/**
 * The insert an Insert control opens, before or after the element; for a
 * table row, prefilled with an empty row of the table's width. `null` when
 * unmapped.
 *
 * @param el - The hovered element.
 * @param position - Before or after it.
 */
export function insertFor(
  el: Element,
  position: 'before' | 'after',
): BlockEdit | null {
  const { startLine, endLine } = sourceRangeOf(el);
  if (!startLine || !endLine) return null;

  let content: string | undefined;
  let context: 'table-row' | undefined;
  if (el.tagName.toLowerCase() === 'tr') {
    const table = el.closest('table');
    const colCount = table ? getTableColumnCount(table) : 3;
    content = '| ' + Array(colCount).fill(' ').join(' | ') + ' |';
    context = 'table-row';
  }

  return {
    label: blockLabel(el),
    mode: {
      kind: 'insert-block',
      atLine: position === 'before' ? startLine : endLine,
      position,
      language: blockLanguage(el.closest('table') ?? el),
      content,
      context,
    },
  };
}

/**
 * The text the Copy control copies: a cell's text, else the element's source
 * lines. `null` when there is nothing to copy (an empty cell, an unmapped
 * element).
 *
 * @param el - The hovered element.
 * @param rawContent - The file's source.
 */
export function copyTextOf(el: Element, rawContent: string): string | null {
  if (isCell(el)) return el.textContent?.trim() || null;
  const { startLine, endLine } = sourceRangeOf(el);
  if (!startLine || !endLine) return null;
  return extractSourceLines(rawContent, startLine, endLine);
}
