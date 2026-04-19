/**
 * Unified file mutation endpoint: edit-block, delete-block, insert-block,
 * edit-cell, toggle-checkbox.  Insider-only, .md files only.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import type { FastifyPluginAsync } from 'fastify';

import { getConfig } from '../../config/index.js';
import { withFileLock } from '../../util/fileMutex.js';
import { getRoots, urlPathToFs } from '../../util/platform.js';

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

type MutationBody =
  | EditBlockBody
  | DeleteBlockBody
  | InsertBlockBody
  | EditCellBody
  | ToggleCheckboxBody;

/** Minimal Fastify reply interface used by mutation handlers. */
interface MutationReply {
  code: (c: number) => { send: (d: unknown) => unknown };
  send: (d: unknown) => unknown;
}

/** Read a file and split into lines, returning 404 on missing file. */
async function readFileLines(
  filePath: string,
  reply: MutationReply,
): Promise<string[] | null> {
  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch {
    reply.code(404).send({ error: 'File not found' });
    return null;
  }
  return content.split(/\r?\n/);
}

export const fileMutationRoutes: FastifyPluginAsync = (fastify) => {
  const roots = getRoots(getConfig().roots);

  fastify.post<{
    Params: { '*': string };
    Body: MutationBody;
  }>('/api/file/*', async (request, reply) => {
    if (request.accessMode !== 'insider') {
      return reply.code(403).send({ error: 'Insider access required' });
    }

    const reqPath = request.params['*'];
    if (!reqPath) return reply.code(400).send({ error: 'Path required' });

    // Validate .md extension
    if (!reqPath.endsWith('.md')) {
      return reply.code(400).send({ error: 'Only .md files are supported' });
    }

    const fsPath = urlPathToFs(reqPath, roots);
    if (!fsPath) return reply.code(404).send({ error: 'Invalid path' });
    const resolved = path.resolve(fsPath);

    const body = request.body as MutationBody | undefined;
    if (!body || typeof body.action !== 'string') {
      return reply.code(400).send({ error: 'Missing action field' });
    }

    return withFileLock(resolved, async () => {
      switch (body.action) {
        case 'edit-block':
          return handleEditBlock(resolved, body, reply);
        case 'delete-block':
          return handleDeleteBlock(resolved, body, reply);
        case 'insert-block':
          return handleInsertBlock(resolved, body, reply);
        case 'edit-cell':
          return handleEditCell(resolved, body, reply);
        case 'toggle-checkbox':
          return handleToggleCheckbox(resolved, body, reply);
        default:
          return reply.code(400).send({
            error: `Unknown action: ${(body as { action: string }).action}`,
          });
      }
    });
  });

  return Promise.resolve();
};

async function handleEditBlock(
  filePath: string,
  body: EditBlockBody,
  reply: MutationReply,
) {
  const { startLine, endLine, content } = body;

  if (
    typeof startLine !== 'number' ||
    typeof endLine !== 'number' ||
    typeof content !== 'string'
  ) {
    return reply
      .code(400)
      .send({ error: 'edit-block requires startLine, endLine, and content' });
  }
  if (startLine > endLine) {
    return reply.code(400).send({ error: 'startLine must not exceed endLine' });
  }
  if (content === '') {
    return reply.code(400).send({ error: 'content must not be empty' });
  }

  const lines = await readFileLines(filePath, reply);
  if (!lines) return;
  if (startLine < 1 || endLine > lines.length) {
    return reply.code(400).send({ error: 'Line range out of bounds' });
  }

  // Split content by line breaks, discard trailing empty element from split
  const newLines = content.split(/\r?\n/);
  if (newLines.length > 0 && newLines[newLines.length - 1] === '') {
    newLines.pop();
  }

  lines.splice(startLine - 1, endLine - startLine + 1, ...newLines);
  await fs.writeFile(filePath, lines.join('\n'), 'utf8');
  return reply.send({ ok: true });
}

async function handleDeleteBlock(
  filePath: string,
  body: DeleteBlockBody,
  reply: MutationReply,
) {
  const { startLine, endLine } = body;

  if (typeof startLine !== 'number' || typeof endLine !== 'number') {
    return reply
      .code(400)
      .send({ error: 'delete-block requires startLine and endLine' });
  }
  if (startLine > endLine) {
    return reply.code(400).send({ error: 'startLine must not exceed endLine' });
  }

  const lines = await readFileLines(filePath, reply);
  if (!lines) return;
  if (startLine < 1 || endLine > lines.length) {
    return reply.code(400).send({ error: 'Line range out of bounds' });
  }

  lines.splice(startLine - 1, endLine - startLine + 1);
  await fs.writeFile(filePath, lines.join('\n'), 'utf8');
  return reply.send({ ok: true });
}

async function handleInsertBlock(
  filePath: string,
  body: InsertBlockBody,
  reply: MutationReply,
) {
  const { atLine, position, content, context } = body;

  if (
    typeof atLine !== 'number' ||
    typeof position !== 'string' ||
    typeof content !== 'string'
  ) {
    return reply
      .code(400)
      .send({ error: 'insert-block requires atLine, position, and content' });
  }
  let fileContent: string;
  try {
    fileContent = await fs.readFile(filePath, 'utf8');
  } catch {
    // File not found — treat as empty file
    fileContent = '';
  }

  const lines = fileContent === '' ? [] : fileContent.split(/\r?\n/);

  // For non-empty files, validate atLine is in range
  if (lines.length > 0 && (atLine < 1 || atLine > lines.length)) {
    return reply.code(400).send({ error: 'atLine out of bounds' });
  }

  // Split content, discard trailing empty element
  const newLines = content.split(/\r?\n/);
  if (newLines.length > 0 && newLines[newLines.length - 1] === '') {
    newLines.pop();
  }

  if (context === 'table-row') {
    // No blank-line separators for table rows
    const insertIdx = position === 'before' ? atLine - 1 : atLine;
    lines.splice(insertIdx, 0, ...newLines);
  } else {
    // Default context: insert with blank-line separators
    const insertIdx = position === 'before' ? atLine - 1 : atLine;
    const isAtStart = insertIdx === 0;
    const isAtEnd = insertIdx >= lines.length;

    const toInsert: string[] = [];

    // Add leading blank line separator if not at start and adjacent line isn't already blank
    if (!isAtStart && lines[insertIdx - 1].trim() !== '') {
      toInsert.push('');
    }

    toInsert.push(...newLines);

    // Add trailing blank line separator if not at end and adjacent line isn't already blank
    if (!isAtEnd && lines[insertIdx].trim() !== '') {
      toInsert.push('');
    }

    lines.splice(insertIdx, 0, ...toInsert);
  }

  await fs.writeFile(filePath, lines.join('\n'), 'utf8');
  return reply.send({ ok: true });
}

async function handleEditCell(
  filePath: string,
  body: EditCellBody,
  reply: MutationReply,
) {
  const { line, col, content } = body;

  if (
    typeof line !== 'number' ||
    typeof col !== 'number' ||
    typeof content !== 'string'
  ) {
    return reply
      .code(400)
      .send({ error: 'edit-cell requires line, col, and content' });
  }

  const lines = await readFileLines(filePath, reply);
  if (!lines) return;
  if (line < 1 || line > lines.length) {
    return reply.code(400).send({ error: 'Line out of bounds' });
  }

  const rawLine = lines[line - 1];

  // Reject edits to separator rows (e.g. |---|:---:|---:|)
  if (/^\|?[\s:|-]+\|?$/.test(rawLine)) {
    return reply.code(400).send({ error: 'Cannot edit a separator row' });
  }

  const PIPE_PLACEHOLDER = '%%PIPE%%';

  // Replace escaped pipes with placeholder before splitting
  const escaped = rawLine.replace(/\\\|/g, PIPE_PLACEHOLDER);
  const cells = escaped.split('|');

  const trimmed = escaped.trim();
  const hasLeadingPipe = trimmed.startsWith('|');
  const hasTrailingPipe = trimmed.endsWith('|');
  const dataStart = hasLeadingPipe ? 1 : 0;
  const dataEnd = hasTrailingPipe ? cells.length - 1 : cells.length; // exclusive
  const dataCount = dataEnd - dataStart;

  if (col < 0 || col >= dataCount) {
    return reply.code(400).send({ error: 'Column index out of bounds' });
  }

  // Escape unescaped pipes in user content to prevent breaking table structure
  const escapedContent = content.replace(/(?<!\\)\|/g, '\\|');

  // Replace the data cell, preserving spacing style
  cells[dataStart + col] = ` ${escapedContent} `;

  // Reconstruct and restore escaped pipes
  const reconstructed = cells
    .join('|')
    .replace(new RegExp(PIPE_PLACEHOLDER, 'g'), '\\|');
  lines[line - 1] = reconstructed;

  await fs.writeFile(filePath, lines.join('\n'), 'utf8');
  return reply.send({ ok: true });
}

async function handleToggleCheckbox(
  filePath: string,
  body: ToggleCheckboxBody,
  reply: MutationReply,
) {
  const { index, checked } = body;

  if (typeof index !== 'number' || typeof checked !== 'boolean') {
    return reply.code(400).send({
      error: 'toggle-checkbox requires index (number) and checked (boolean)',
    });
  }

  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch {
    return reply.code(404).send({ error: 'File not found' });
  }

  const toggled = toggleCheckbox(content, index, checked);
  if (!toggled) {
    return reply.code(400).send({
      error: `Checkbox index ${String(index)} out of range`,
    });
  }

  await fs.writeFile(filePath, toggled.result, 'utf8');
  return reply.send({ ok: true });
}
