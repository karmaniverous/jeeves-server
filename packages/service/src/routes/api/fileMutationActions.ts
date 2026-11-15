/**
 * The five Markdown file mutations of `POST /api/file/*` (edit-block, delete-block, insert-block, edit-cell, toggle-checkbox): each checks its own fields and line numbers, throwing `SERVER_INVALID_REQUEST` or `SERVER_NOT_FOUND`, and rewrites the file. Callers hold the per-file lock.
 *
 * @packageDocumentation
 */

import fs from 'node:fs/promises';

import { capArg, InvalidRequest, NotFound } from '../../api/errors.js';

/**
 * Regex matching a GFM task-list checkbox: a list marker followed by `[ ]`, `[x]`, or `[X]`.
 */
const CHECKBOX_PATTERN = /^(\s*([-*+]|\d+\.)\s+)\[([ xX])\]/gm;

/**
 * Toggle a single checkbox in markdown source by sequential index.
 * Returns the updated content, or null if the index is out of range.
 */
export function toggleCheckbox(
  content: string,
  index: number,
  checked: boolean,
): { result: string; total: number } | null {
  const matches = [...content.matchAll(CHECKBOX_PATTERN)];
  if (index < 0 || index >= matches.length) return null;

  let matchIndex = 0;
  const result = content.replace(
    CHECKBOX_PATTERN,
    (match: string, prefix: string) => {
      const current = matchIndex++;
      if (current === index) {
        return prefix + (checked ? '[x]' : '[ ]');
      }
      return match;
    },
  );

  return { result, total: matches.length };
}

interface EditBlockBody {
  action: 'edit-block';
  startLine: number;
  endLine: number;
  content: string;
}

interface DeleteBlockBody {
  action: 'delete-block';
  startLine: number;
  endLine: number;
}

interface InsertBlockBody {
  action: 'insert-block';
  atLine: number;
  position: 'before' | 'after';
  content: string;
  context?: 'table-row';
}

interface EditCellBody {
  action: 'edit-cell';
  line: number;
  col: number;
  content: string;
}

interface ToggleCheckboxBody {
  action: 'toggle-checkbox';
  index: number;
  checked: boolean;
}

/** A mutation request body. */
export type MutationBody =
  | EditBlockBody
  | DeleteBlockBody
  | InsertBlockBody
  | EditCellBody
  | ToggleCheckboxBody;

/** Read a file, throwing `SERVER_NOT_FOUND` when it can't be read. */
async function readExisting(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    throw new NotFound('File not found');
  }
}

/** Read a file and split it into lines (`SERVER_NOT_FOUND` when missing). */
async function readFileLines(filePath: string): Promise<string[]> {
  return (await readExisting(filePath)).split(/\r?\n/);
}

/** Lines of new content, without the empty element a trailing break leaves. */
function contentLines(content: string): string[] {
  const newLines = content.split(/\r?\n/);
  if (newLines.length > 0 && newLines[newLines.length - 1] === '')
    newLines.pop();
  return newLines;
}

/**
 * Check a block range: `startLine` not after `endLine`.
 *
 * @throws `SERVER_INVALID_REQUEST` when reversed.
 */
function checkRangeOrder(startLine: number, endLine: number): void {
  if (startLine > endLine)
    throw new InvalidRequest('startLine must not exceed endLine');
}

/**
 * Check a block range lies within the file.
 *
 * @throws `SERVER_INVALID_REQUEST` when out of bounds.
 */
function checkRangeBounds(
  startLine: number,
  endLine: number,
  lines: string[],
): void {
  if (startLine < 1 || endLine > lines.length)
    throw new InvalidRequest('Line range out of bounds');
}

async function editBlock(filePath: string, body: EditBlockBody) {
  const { startLine, endLine, content } = body;
  if (
    typeof startLine !== 'number' ||
    typeof endLine !== 'number' ||
    typeof content !== 'string'
  )
    throw new InvalidRequest(
      'edit-block requires startLine, endLine, and content',
    );
  checkRangeOrder(startLine, endLine);
  if (content === '') throw new InvalidRequest('content must not be empty');

  const lines = await readFileLines(filePath);
  checkRangeBounds(startLine, endLine, lines);
  lines.splice(
    startLine - 1,
    endLine - startLine + 1,
    ...contentLines(content),
  );
  await fs.writeFile(filePath, lines.join('\n'), 'utf8');
}

async function deleteBlock(filePath: string, body: DeleteBlockBody) {
  const { startLine, endLine } = body;
  if (typeof startLine !== 'number' || typeof endLine !== 'number')
    throw new InvalidRequest('delete-block requires startLine and endLine');
  checkRangeOrder(startLine, endLine);

  const lines = await readFileLines(filePath);
  checkRangeBounds(startLine, endLine, lines);
  lines.splice(startLine - 1, endLine - startLine + 1);
  await fs.writeFile(filePath, lines.join('\n'), 'utf8');
}

async function insertBlock(filePath: string, body: InsertBlockBody) {
  // Validate at runtime — body comes from user input and may not match the type.
  const { atLine, position, content, context } = body as unknown as Record<
    string,
    unknown
  >;
  if (
    typeof atLine !== 'number' ||
    typeof content !== 'string' ||
    (position !== 'before' && position !== 'after')
  )
    throw new InvalidRequest(
      'insert-block requires atLine, content, and position (before|after)',
    );

  // A missing file is treated as empty.
  const fileContent = await fs.readFile(filePath, 'utf8').catch(() => '');
  const lines = fileContent === '' ? [] : fileContent.split(/\r?\n/);

  if (lines.length > 0 && (atLine < 1 || atLine > lines.length))
    throw new InvalidRequest('atLine out of bounds');

  const newLines = contentLines(content);
  const insertIdx = position === 'before' ? atLine - 1 : atLine;
  if (context === 'table-row') {
    // No blank-line separators for table rows
    lines.splice(insertIdx, 0, ...newLines);
  } else {
    // Default context: insert with blank-line separators where the
    // adjacent lines aren't already blank.
    const toInsert: string[] = [];
    if (insertIdx !== 0 && lines[insertIdx - 1].trim() !== '')
      toInsert.push('');
    toInsert.push(...newLines);
    if (insertIdx < lines.length && lines[insertIdx].trim() !== '')
      toInsert.push('');
    lines.splice(insertIdx, 0, ...toInsert);
  }

  await fs.writeFile(filePath, lines.join('\n'), 'utf8');
}

async function editCell(filePath: string, body: EditCellBody) {
  const { line, col, content } = body;
  if (
    typeof line !== 'number' ||
    typeof col !== 'number' ||
    typeof content !== 'string'
  )
    throw new InvalidRequest('edit-cell requires line, col, and content');

  const lines = await readFileLines(filePath);
  if (line < 1 || line > lines.length)
    throw new InvalidRequest('Line out of bounds');

  const rawLine = lines[line - 1];

  // Reject edits to separator rows (e.g. |---|:---:|---:|)
  if (/^\|?[\s:|-]+\|?$/.test(rawLine))
    throw new InvalidRequest('Cannot edit a separator row');

  const PIPE_PLACEHOLDER = '%%PIPE%%';

  // Replace escaped pipes with a placeholder before splitting
  const escaped = rawLine.replace(/\\\|/g, PIPE_PLACEHOLDER);
  const cells = escaped.split('|');

  const trimmed = escaped.trim();
  const dataStart = trimmed.startsWith('|') ? 1 : 0;
  const dataEnd = trimmed.endsWith('|') ? cells.length - 1 : cells.length; // exclusive

  if (col < 0 || col >= dataEnd - dataStart)
    throw new InvalidRequest('Column index out of bounds');

  // Escape unescaped pipes in user content to prevent breaking table structure
  const escapedContent = content.replace(/(?<!\\)\|/g, '\\|');

  // Replace the data cell, preserving spacing style
  cells[dataStart + col] = ` ${escapedContent} `;

  // Reconstruct and restore escaped pipes
  lines[line - 1] = cells
    .join('|')
    .replace(new RegExp(PIPE_PLACEHOLDER, 'g'), '\\|');

  await fs.writeFile(filePath, lines.join('\n'), 'utf8');
}

async function toggleCheckboxAction(
  filePath: string,
  body: ToggleCheckboxBody,
) {
  const { index, checked } = body;
  if (typeof index !== 'number' || typeof checked !== 'boolean')
    throw new InvalidRequest(
      'toggle-checkbox requires index (number) and checked (boolean)',
    );

  const toggled = toggleCheckbox(await readExisting(filePath), index, checked);
  if (!toggled)
    throw new InvalidRequest(`Checkbox index ${String(index)} out of range`);

  await fs.writeFile(filePath, toggled.result, 'utf8');
}

/**
 * Apply a mutation to a Markdown file.
 *
 * @param filePath - The file (absolute).
 * @param body - The mutation; its `action` must be a string.
 * @throws `SERVER_INVALID_REQUEST` for an unknown action or invalid fields,
 *   `SERVER_NOT_FOUND` when the file is missing (except insert-block).
 */
export async function applyMutation(
  filePath: string,
  body: MutationBody,
): Promise<void> {
  switch (body.action) {
    case 'edit-block':
      return editBlock(filePath, body);
    case 'delete-block':
      return deleteBlock(filePath, body);
    case 'insert-block':
      return insertBlock(filePath, body);
    case 'edit-cell':
      return editCell(filePath, body);
    case 'toggle-checkbox':
      return toggleCheckboxAction(filePath, body);
    default:
      throw new InvalidRequest(
        `Unknown action: ${capArg((body as { action: string }).action)}`,
      );
  }
}
