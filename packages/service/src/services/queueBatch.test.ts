// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_BATCH_BYTES, readBatch } from './queueBatch.js';

let dir: string;
let queue: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'batch-'));
  queue = path.join(dir, 'q.jsonl');
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('readBatch', () => {
  it('reads nothing from a missing queue', () => {
    expect(readBatch(queue, 0)).toEqual({ lines: [], end: 0, size: 0 });
  });

  it('returns complete lines with their offsets', () => {
    fs.writeFileSync(queue, 'a\n\nbé\n');
    expect(readBatch(queue, 0)).toEqual({
      lines: [
        { offset: 0, text: 'a' },
        { offset: 2, text: '' },
        { offset: 3, text: 'bé' },
      ],
      end: 7,
      size: 7,
    });
    expect(readBatch(queue, 2).lines.map((l) => l.text)).toEqual(['', 'bé']);
  });

  it('leaves an unterminated last line for the next read', () => {
    fs.writeFileSync(queue, 'a\n{"torn":');
    expect(readBatch(queue, 0)).toMatchObject({
      lines: [{ offset: 0, text: 'a' }],
      end: 2,
    });
    expect(readBatch(queue, 2)).toMatchObject({ lines: [], end: 2 });
    fs.appendFileSync(queue, '1}\n');
    expect(readBatch(queue, 2)).toMatchObject({
      lines: [{ offset: 2, text: '{"torn":1}' }],
      end: 13,
    });
  });

  it('stops at the last complete line within the limit', () => {
    fs.writeFileSync(queue, 'aaaa\nbbbb\ncccc\n');
    expect(readBatch(queue, 0, 12)).toMatchObject({
      lines: [
        { offset: 0, text: 'aaaa' },
        { offset: 5, text: 'bbbb' },
      ],
      end: 10,
    });
  });

  it('reads a line longer than the limit to its end', () => {
    fs.writeFileSync(queue, `${'x'.repeat(25)}\nyy\nzz`);
    expect(readBatch(queue, 0, 10)).toMatchObject({
      lines: [
        { offset: 0, text: 'x'.repeat(25) },
        { offset: 26, text: 'yy' },
      ],
      end: 29,
    });
    fs.writeFileSync(queue, 'x'.repeat(25));
    expect(readBatch(queue, 0, 10)).toMatchObject({ lines: [], end: 0 });
  });

  it('drains a 10 MiB queue in reads of at most 1 MiB', () => {
    const entry = `${JSON.stringify({ event: 'e', body: { pad: 'x'.repeat(1000) } })}\n`;
    const count = Math.ceil((10 * 1024 * 1024) / entry.length);
    fs.writeFileSync(queue, entry.repeat(count));
    const read = vi.spyOn(fs, 'readSync');
    const readFile = vi.spyOn(fs, 'readFileSync');
    let offset = 0;
    let lines = 0;
    let batches = 0;
    for (;;) {
      const batch = readBatch(queue, offset);
      if (batch.lines.length === 0) break;
      expect(batch.end - offset).toBeLessThanOrEqual(MAX_BATCH_BYTES);
      lines += batch.lines.length;
      offset = batch.end;
      batches += 1;
    }
    expect(lines).toBe(count);
    expect(offset).toBe(count * entry.length);
    expect(batches).toBeGreaterThanOrEqual(10);
    expect(readFile).not.toHaveBeenCalled();
    for (const call of read.mock.calls)
      expect((call[1] as Buffer).length).toBeLessThanOrEqual(MAX_BATCH_BYTES);
  });
});
