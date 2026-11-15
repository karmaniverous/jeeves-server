// @vitest-environment node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cursorAt,
  fileSize,
  HEAD_BYTES,
  resolveCursor,
  writeCursor,
} from './queueCursor.js';

let dir: string;
let queue: string;
let cursor: string;

const line = (n: number) =>
  `{"event":"e${String(n)}","pad":"${'x'.repeat(40)}"}\n`;
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-'));
  queue = path.join(dir, 'q.jsonl');
  cursor = `${queue}.cursor`;
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('cursorAt', () => {
  it('fingerprints the first 64 bytes of a long queue', () => {
    const content = line(1) + line(2);
    fs.writeFileSync(queue, content);
    expect(cursorAt(queue, 10)).toEqual({
      v: 1,
      offset: 10,
      size: content.length,
      head: sha(content.slice(0, HEAD_BYTES)),
      headLen: HEAD_BYTES,
    });
  });

  it('fingerprints a short queue whole, and a missing one as empty', () => {
    fs.writeFileSync(queue, 'abc\n');
    expect(cursorAt(queue, 4)).toMatchObject({
      headLen: 4,
      head: sha('abc\n'),
    });
    fs.rmSync(queue);
    expect(cursorAt(queue, 0)).toEqual({
      v: 1,
      offset: 0,
      size: 0,
      head: sha(''),
      headLen: 0,
    });
  });
});

describe('fileSize', () => {
  it('is the size, or 0 when missing', () => {
    expect(fileSize(queue)).toBe(0);
    fs.writeFileSync(queue, 'abcd');
    expect(fileSize(queue)).toBe(4);
  });
});

describe('resolveCursor', () => {
  beforeEach(() => {
    fs.writeFileSync(queue, line(1) + line(2));
  });

  it('starts at 0 when the cursor is missing (new install)', () => {
    expect(resolveCursor(queue, cursor)).toEqual({
      offset: 0,
      outcome: 'missing',
    });
  });

  it.each([
    ['empty', ''],
    ['whitespace', ' \n'],
    ['non-numeric', 'abc'],
    ['numeric prefix', '12abc'],
    ['garbage', '\u0000\u0001\u00ff'],
    ['negative', '-5'],
    ['wrong version', '{"v":2,"offset":1,"size":1,"head":"","headLen":1}'],
    ['bad headLen', '{"v":1,"offset":1,"size":1,"head":"","headLen":65}'],
    ['bad offset', '{"v":1,"offset":-1,"size":1,"head":"","headLen":1}'],
    ['bad size', '{"v":1,"offset":1,"size":"1","head":"","headLen":1}'],
    ['bad head', '{"v":1,"offset":1,"size":1,"head":1,"headLen":1}'],
  ])(
    'resets to the end of the queue for a %s cursor (no replay)',
    (_l, text) => {
      fs.writeFileSync(cursor, text);
      const resolved = resolveCursor(queue, cursor);
      expect(resolved.offset).toBe(fileSize(queue));
      expect(resolved.outcome).toBe('reset');
      expect(resolved.reason).toBeTruthy();
    },
  );

  it('resets when the cursor is unreadable', () => {
    fs.mkdirSync(cursor);
    expect(resolveCursor(queue, cursor)).toMatchObject({
      outcome: 'reset',
      offset: fileSize(queue),
    });
  });

  it('reads a legacy integer cursor', () => {
    fs.writeFileSync(cursor, `${String(line(1).length)}\n`);
    expect(resolveCursor(queue, cursor)).toEqual({
      offset: line(1).length,
      outcome: 'ok',
    });
  });

  it('rewinds a legacy cursor past the end of the queue', () => {
    fs.writeFileSync(cursor, '999999');
    expect(resolveCursor(queue, cursor)).toMatchObject({
      offset: 0,
      outcome: 'rewound',
    });
  });

  it('reads a v1 cursor on a queue that has grown', () => {
    writeCursor(cursor, cursorAt(queue, line(1).length));
    fs.appendFileSync(queue, line(3));
    expect(resolveCursor(queue, cursor)).toEqual({
      offset: line(1).length,
      outcome: 'ok',
    });
  });

  it('rewinds when the queue was truncated (size < offset)', () => {
    writeCursor(cursor, cursorAt(queue, fileSize(queue)));
    fs.writeFileSync(queue, line(1));
    expect(resolveCursor(queue, cursor)).toMatchObject({
      offset: 0,
      outcome: 'rewound',
    });
  });

  it('rewinds when the queue was replaced (same size, different head)', () => {
    writeCursor(cursor, cursorAt(queue, fileSize(queue)));
    fs.writeFileSync(queue, line(8) + line(9));
    expect(resolveCursor(queue, cursor)).toEqual({
      offset: 0,
      outcome: 'rewound',
      reason: 'queue head differs from the cursor',
    });
  });

  it('keeps a cursor written on a queue shorter than 64 bytes, then appended to', () => {
    fs.writeFileSync(queue, '{"a":1}\n');
    writeCursor(cursor, cursorAt(queue, 8));
    fs.appendFileSync(queue, line(2) + line(3));
    expect(resolveCursor(queue, cursor)).toEqual({ offset: 8, outcome: 'ok' });
  });

  it('rewinds when the queue is now shorter than the fingerprint', () => {
    writeCursor(cursor, cursorAt(queue, 0));
    fs.writeFileSync(queue, 'ab\n');
    expect(resolveCursor(queue, cursor).outcome).toBe('rewound');
  });

  it('keeps an empty-queue cursor (after rotation) for a fresh queue', () => {
    fs.rmSync(queue);
    writeCursor(cursor, cursorAt(queue, 0));
    fs.writeFileSync(queue, line(1));
    expect(resolveCursor(queue, cursor)).toEqual({ offset: 0, outcome: 'ok' });
  });
});

describe('writeCursor', () => {
  it('leaves the previous cursor intact when the write fails', () => {
    fs.writeFileSync(queue, line(1));
    writeCursor(cursor, cursorAt(queue, 0));
    const before = fs.readFileSync(cursor, 'utf8');
    vi.spyOn(fs, 'writeFileSync').mockImplementationOnce(() => {
      throw new Error('ENOSPC');
    });
    expect(() => {
      writeCursor(cursor, cursorAt(queue, line(1).length));
    }).toThrow('ENOSPC');
    expect(fs.readFileSync(cursor, 'utf8')).toBe(before);
    expect(resolveCursor(queue, cursor)).toEqual({ offset: 0, outcome: 'ok' });
  });
});
