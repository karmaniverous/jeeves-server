/**
 * Toggle-checkbox endpoint: flip a single GFM task-list checkbox.
 * Insider-only. Uses mtime-based stale-write protection.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import type { FastifyPluginAsync } from 'fastify';

import { getConfig } from '../../config/index.js';
import { getRoots, urlPathToFs } from '../../util/platform.js';

/** Regex matching a GFM task-list checkbox token: `[ ]` or `[x]` / `[X]`. */
const CHECKBOX_PATTERN = /\[([ xX])\]/g;

/**
 * Toggle a single checkbox in markdown source by sequential index.
 * Returns the updated content, or null if the index is out of range.
 */
export function toggleCheckbox(
  content: string,
  index: number,
  checked: boolean,
): { result: string; total: number } | null {
  // Count total checkboxes first
  const matches = [...content.matchAll(CHECKBOX_PATTERN)];
  if (index < 0 || index >= matches.length) return null;

  // Replace the Nth match
  let matchIndex = 0;
  const result = content.replace(CHECKBOX_PATTERN, (match: string) => {
    const current = matchIndex++;
    if (current === index) {
      return checked ? '[x]' : '[ ]';
    }
    return match;
  });

  return { result, total: matches.length };
}

export const toggleCheckboxRoutes: FastifyPluginAsync = (fastify) => {
  const roots = getRoots(getConfig().roots);

  fastify.post<{
    Params: { '*': string };
    Body: { index: number; checked: boolean; mtime: number };
  }>('/api/file/*/toggle-checkbox', async (request, reply) => {
    // Insider-only
    if (request.accessMode !== 'insider') {
      return reply.code(403).send({ error: 'Insider access required' });
    }

    const reqPath = request.params['*'];
    if (!reqPath) return reply.code(400).send({ error: 'Path required' });

    const fsPath = urlPathToFs(reqPath, roots);
    if (!fsPath) return reply.code(404).send({ error: 'Invalid path' });
    const resolved = path.resolve(fsPath);

    try {
      await fs.access(resolved);
    } catch {
      return reply.code(404).send({ error: 'File not found' });
    }

    const { index, checked, mtime } = request.body as {
      index: unknown;
      checked: unknown;
      mtime: unknown;
    };

    if (
      typeof index !== 'number' ||
      typeof checked !== 'boolean' ||
      typeof mtime !== 'number'
    ) {
      return reply.code(400).send({
        error:
          'Request body must include index (number), checked (boolean), and mtime (number)',
      });
    }

    // Stale-write check
    const stats = await fs.stat(resolved);
    if (Math.abs(stats.mtimeMs - mtime) > 1) {
      return reply.code(409).send({
        conflict: true,
        mtime: stats.mtimeMs,
      });
    }

    // Read file and toggle the Nth checkbox
    const content = await fs.readFile(resolved, 'utf8');
    const toggled = toggleCheckbox(content, index, checked);

    if (!toggled) {
      return reply.code(400).send({
        error: `Checkbox index ${String(index)} out of range`,
      });
    }

    // Write the updated content
    await fs.writeFile(resolved, toggled.result, 'utf8');

    const newStats = await fs.stat(resolved);
    return reply.send({ ok: true, mtime: newStats.mtimeMs });
  });

  return Promise.resolve();
};
