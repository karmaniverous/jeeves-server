/**
 * Bounded reads of the event queue: from an offset, a positioned read of at most `MAX_BATCH_BYTES`, complete lines only (an unterminated last line waits for the next read; a single line longer than the limit is read to its end). The file is never read whole.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';

/** Most bytes read per batch (a longer single line is read to its end). */
export const MAX_BATCH_BYTES = 1024 * 1024;

/** One complete queue line. */
export interface QueueLine {
  /** Byte offset of the line's start. */
  offset: number;
  /** The line, without its `\n`. */
  text: string;
}

/** One batch read from the queue. */
export interface QueueBatch {
  /** Complete lines, in order (blank lines included). */
  lines: QueueLine[];
  /** Offset just past the last complete line (the input offset when none). */
  end: number;
  /** Queue size when read (0 when missing). */
  size: number;
}

/**
 * Read from `offset` until the end of the last complete line within
 * `maxBytes`, or to the end of the first line when that line is longer.
 *
 * @returns The bytes, empty when no complete line is available.
 */
function readCompleteLines(
  fd: number,
  offset: number,
  size: number,
  maxBytes: number,
): Buffer {
  const parts: Buffer[] = [];
  for (let pos = offset; pos < size;) {
    const len = Math.min(maxBytes, size - pos);
    const buf = Buffer.alloc(len);
    const chunk = buf.subarray(0, fs.readSync(fd, buf, 0, len, pos));
    if (chunk.length === 0) break;
    const lastNewline = chunk.lastIndexOf(0x0a);
    if (lastNewline >= 0) {
      parts.push(chunk.subarray(0, lastNewline + 1));
      return Buffer.concat(parts);
    }
    parts.push(chunk);
    pos += chunk.length;
  }
  return Buffer.alloc(0);
}

/**
 * Split `\n`-terminated bytes into lines with their offsets.
 *
 * @param bytes - Complete lines.
 * @param base - Offset of `bytes` in the file.
 * @returns The lines.
 */
function splitLines(bytes: Buffer, base: number): QueueLine[] {
  const lines: QueueLine[] = [];
  for (let start = 0; start < bytes.length;) {
    const newline = bytes.indexOf(0x0a, start);
    lines.push({
      offset: base + start,
      text: bytes.toString('utf8', start, newline),
    });
    start = newline + 1;
  }
  return lines;
}

/**
 * Read the next batch of complete lines from the queue.
 *
 * @param queuePath - The queue file.
 * @param offset - Where to start.
 * @param maxBytes - Read limit (default {@link MAX_BATCH_BYTES}).
 * @returns The batch.
 */
export function readBatch(
  queuePath: string,
  offset: number,
  maxBytes = MAX_BATCH_BYTES,
): QueueBatch {
  let fd: number;
  try {
    fd = fs.openSync(queuePath, 'r');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT')
      return { lines: [], end: offset, size: 0 };
    throw err;
  }
  try {
    const { size } = fs.fstatSync(fd);
    const bytes = readCompleteLines(fd, offset, size, maxBytes);
    return {
      lines: splitLines(bytes, offset),
      end: offset + bytes.length,
      size,
    };
  } finally {
    fs.closeSync(fd);
  }
}
