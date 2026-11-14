/**
 * JSONL helpers shared by the queue, the event log and the webhook events log: appends with append hygiene (a torn last line is closed before the next entry) and tolerant line-by-line parsing (malformed lines are skipped, counted and logged at debug).
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import path from 'node:path';

/** Files whose last byte has been checked since start-up. */
const checkedTails = new Set<string>();

/**
 * Whether a file exists, is non-empty and doesn't end with `\n` (a write
 * torn by a full disk or a crash).
 *
 * @param filePath - The file.
 * @returns True when its last line is unterminated.
 */
export function hasTornTail(filePath: string): boolean {
  let fd: number;
  try {
    fd = fs.openSync(filePath, 'r');
  } catch {
    return false;
  }
  try {
    const { size } = fs.fstatSync(fd);
    if (size === 0) return false;
    const last = Buffer.alloc(1);
    fs.readSync(fd, last, 0, 1, size - 1);
    return last[0] !== 0x0a;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Append one JSON value as a line. Before the first append after start-up
 * (and after a failed append), a torn last line is closed with `\n` first,
 * so the fragment stays on its own line and never corrupts this entry.
 *
 * @param filePath - The JSONL file.
 * @param value - The value to append.
 */
export function appendJsonlLine(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const prefix =
    !checkedTails.has(filePath) && hasTornTail(filePath) ? '\n' : '';
  try {
    fs.appendFileSync(filePath, `${prefix}${JSON.stringify(value)}\n`, 'utf8');
    checkedTails.add(filePath);
  } catch (err) {
    checkedTails.delete(filePath);
    throw err;
  }
}

/**
 * Parse one line as a JSON object.
 *
 * @param line - The line.
 * @returns The object, or undefined when the line isn't a JSON object.
 */
export function parseJsonObject(
  line: string,
): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(line);
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Parse JSONL text line by line: blank lines are ignored, malformed lines
 * skipped and counted (logged at debug).
 *
 * @param text - The file content.
 * @param source - Name for the debug log.
 * @returns The objects, in order, and the number of lines skipped.
 */
export function parseJsonlObjects(
  text: string,
  source: string,
): { entries: Record<string, unknown>[]; skipped: number } {
  const entries: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const entry = parseJsonObject(line);
    if (entry) entries.push(entry);
    else skipped += 1;
  }
  if (skipped > 0)
    console.debug(
      `[jsonl] skipped ${String(skipped)} malformed line(s) in ${source}`,
    );
  return { entries, skipped };
}
