/**
 * The event queue cursor (`<queue>.cursor`): v1 is `{ v, offset, size, head, headLen }`, where `head` is the sha256 of the queue's first `headLen` (at most 64) bytes, written atomically; a legacy plain integer is still read. Resolving the cursor against the current queue decides where processing starts: missing means 0, untrustworthy means the end (no replay), truncated or replaced means 0 of the new file (no loss).
 *
 * @packageDocumentation
 */

import crypto from 'node:crypto';
import fs from 'node:fs';

import { writeFileAtomic } from '../util/atomicWrite.js';
import { parseJsonObject } from '../util/jsonl.js';

/** Bytes of the queue's start fingerprinted in the cursor. */
export const HEAD_BYTES = 64;

/** Cursor v1. */
export interface QueueCursor {
  v: 1;
  /** Byte offset processing has reached (end of the last complete line). */
  offset: number;
  /** Queue size when the cursor was written. */
  size: number;
  /** sha256 (hex) of the queue's first `headLen` bytes. */
  head: string;
  /** Bytes hashed: min(64, size). */
  headLen: number;
}

/** What the cursor file holds. */
type CursorFile =
  | { kind: 'missing' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'legacy'; offset: number }
  | { kind: 'v1'; cursor: QueueCursor };

/** Where processing starts, and why. */
export interface ResolvedCursor {
  offset: number;
  /** `reset`: the cursor couldn't be trusted; `rewound`: the queue was truncated or replaced. */
  outcome: 'ok' | 'missing' | 'reset' | 'rewound';
  /** Why the cursor was reset or rewound. */
  reason?: string;
}

const isCount = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

/**
 * Read and validate the cursor file.
 *
 * @param cursorPath - The cursor file.
 * @returns Its content.
 */
function readCursorFile(cursorPath: string): CursorFile {
  let text: string;
  try {
    text = fs.readFileSync(cursorPath, 'utf8').trim();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT')
      return { kind: 'missing' };
    return { kind: 'invalid', reason: `unreadable: ${String(err)}` };
  }
  if (!text) return { kind: 'invalid', reason: 'empty' };
  if (/^\d+$/.test(text)) {
    const offset = Number(text);
    if (isCount(offset)) return { kind: 'legacy', offset };
  }
  const c = parseJsonObject(text);
  if (
    c?.v === 1 &&
    isCount(c.offset) &&
    isCount(c.size) &&
    typeof c.head === 'string' &&
    isCount(c.headLen) &&
    c.headLen <= HEAD_BYTES
  )
    return { kind: 'v1', cursor: c as unknown as QueueCursor };
  return { kind: 'invalid', reason: `not a cursor: ${text.slice(0, 200)}` };
}

/**
 * A file's first bytes.
 *
 * @param filePath - The file.
 * @param len - Bytes wanted.
 * @returns Up to `len` bytes (fewer when the file is shorter or missing).
 */
function readHead(filePath: string, len: number): Buffer {
  const buf = Buffer.alloc(len);
  if (len === 0) return buf;
  let fd: number;
  try {
    fd = fs.openSync(filePath, 'r');
  } catch {
    return Buffer.alloc(0);
  }
  try {
    return buf.subarray(0, fs.readSync(fd, buf, 0, len, 0));
  } finally {
    fs.closeSync(fd);
  }
}

const sha256 = (buf: Buffer): string =>
  crypto.createHash('sha256').update(buf).digest('hex');

/**
 * Whether the queue still starts with the bytes the cursor fingerprinted.
 *
 * @param queuePath - The queue file.
 * @param cursor - The cursor.
 * @returns True when its first `headLen` bytes hash to `head`.
 */
function headMatches(queuePath: string, cursor: QueueCursor): boolean {
  const head = readHead(queuePath, cursor.headLen);
  return head.length === cursor.headLen && sha256(head) === cursor.head;
}

/**
 * A file's size, 0 when it is missing.
 *
 * @param filePath - The file.
 * @returns Its size in bytes.
 */
export function fileSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

/**
 * The cursor for an offset into the queue as it is now.
 *
 * @param queuePath - The queue file.
 * @param offset - The offset reached.
 * @returns The cursor.
 */
export function cursorAt(queuePath: string, offset: number): QueueCursor {
  const head = readHead(queuePath, HEAD_BYTES);
  return {
    v: 1,
    offset,
    size: fileSize(queuePath),
    head: sha256(head),
    headLen: head.length,
  };
}

/**
 * Write the cursor atomically (temp file + rename): a failed write leaves
 * the previous cursor intact.
 *
 * @param cursorPath - The cursor file.
 * @param cursor - The cursor.
 */
export function writeCursor(cursorPath: string, cursor: QueueCursor): void {
  writeFileAtomic(cursorPath, JSON.stringify(cursor));
}

/**
 * Decide where processing starts: the cursor checked against the queue.
 *
 * @param queuePath - The queue file.
 * @param cursorPath - The cursor file.
 * @returns The offset and the outcome.
 */
export function resolveCursor(
  queuePath: string,
  cursorPath: string,
): ResolvedCursor {
  const file = readCursorFile(cursorPath);
  const size = fileSize(queuePath);
  if (file.kind === 'missing') return { offset: 0, outcome: 'missing' };
  if (file.kind === 'invalid')
    return { offset: size, outcome: 'reset', reason: file.reason };
  const offset = file.kind === 'v1' ? file.cursor.offset : file.offset;
  if (size < offset)
    return {
      offset: 0,
      outcome: 'rewound',
      reason: `queue size ${String(size)} < cursor offset ${String(offset)}`,
    };
  if (file.kind === 'v1' && !headMatches(queuePath, file.cursor))
    return {
      offset: 0,
      outcome: 'rewound',
      reason: 'queue head differs from the cursor',
    };
  return { offset, outcome: 'ok' };
}
