/**
 * Event queue progress for `GET /status` (`health.eventQueue`): the offset the processor has reached, the queue size, and counts and timestamps since start.
 *
 * @packageDocumentation
 */

import type { ServerHealth } from '@karmaniverous/jeeves-server-core';

import { getConfig } from '../config/index.js';
import { fileSize } from './queueCursor.js';

/** Processor state since start. */
const state: {
  offset: number;
  parseErrors: number;
  lastCursorReset?: string;
  lastRewind?: string;
} = { offset: 0, parseErrors: 0 };

/**
 * Record the offset the processor has reached.
 *
 * @param offset - The offset.
 */
export function noteOffset(offset: number): void {
  state.offset = offset;
}

/** Count a malformed queue line. */
export function noteParseError(): void {
  state.parseErrors += 1;
}

/**
 * Record a cursor reset or a rewind.
 *
 * @param kind - Which.
 * @param at - When (ISO).
 */
export function noteCursorEvent(kind: 'reset' | 'rewound', at: string): void {
  if (kind === 'reset') state.lastCursorReset = at;
  else state.lastRewind = at;
}

/**
 * The `health.eventQueue` block.
 *
 * @returns Offset, size, pending bytes, parse errors and the last reset and rewind.
 */
export function getEventQueueHealth(): ServerHealth['eventQueue'] {
  const size = fileSize(getConfig().eventQueuePath);
  return {
    offset: state.offset,
    size,
    pendingBytes: Math.max(0, size - state.offset),
    parseErrors: state.parseErrors,
    ...(state.lastCursorReset
      ? { lastCursorReset: state.lastCursorReset }
      : {}),
    ...(state.lastRewind ? { lastRewind: state.lastRewind } : {}),
  };
}
