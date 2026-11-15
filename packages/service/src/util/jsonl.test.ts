// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writeFileAtomic } from './atomicWrite.js';
import {
  appendJsonlLine,
  hasTornTail,
  parseJsonlObjects,
  parseJsonObject,
} from './jsonl.js';

let dir: string;
let file: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsonl-'));
  file = path.join(dir, 'sub', 'log.jsonl');
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('hasTornTail', () => {
  it('is false for a missing, empty or \\n-terminated file', () => {
    expect(hasTornTail(file)).toBe(false);
    fs.mkdirSync(path.dirname(file));
    fs.writeFileSync(file, '');
    expect(hasTornTail(file)).toBe(false);
    fs.writeFileSync(file, '{"a":1}\n');
    expect(hasTornTail(file)).toBe(false);
  });

  it('is true when the last byte is not \\n', () => {
    fs.mkdirSync(path.dirname(file));
    fs.writeFileSync(file, '{"a":1}\n{"b":');
    expect(hasTornTail(file)).toBe(true);
  });
});

describe('appendJsonlLine', () => {
  it('creates the file and appends one line per value', () => {
    appendJsonlLine(file, { a: 1 });
    appendJsonlLine(file, { b: 2 });
    expect(fs.readFileSync(file, 'utf8')).toBe('{"a":1}\n{"b":2}\n');
  });

  it('closes a torn last line before the first append only', () => {
    fs.mkdirSync(path.dirname(file));
    fs.writeFileSync(file, '{"torn":');
    appendJsonlLine(file, { a: 1 });
    // A later torn tail isn't re-checked while appends succeed.
    fs.appendFileSync(file, 'x');
    appendJsonlLine(file, { b: 2 });
    expect(fs.readFileSync(file, 'utf8')).toBe('{"torn":\n{"a":1}\nx{"b":2}\n');
  });

  it('checks the tail again after a failed append', () => {
    appendJsonlLine(file, { a: 1 });
    const append = vi.spyOn(fs, 'appendFileSync').mockImplementationOnce(() => {
      fs.writeFileSync(file, '{"a":1}\n{"part', { flag: 'w' });
      throw new Error('ENOSPC');
    });
    expect(() => {
      appendJsonlLine(file, { b: 2 });
    }).toThrow('ENOSPC');
    append.mockRestore();
    appendJsonlLine(file, { c: 3 });
    expect(fs.readFileSync(file, 'utf8')).toBe('{"a":1}\n{"part\n{"c":3}\n');
  });
});

describe('parseJsonObject', () => {
  it.each([['[1]'], ['1'], ['null'], ['"s"'], ['{"a":'], ['']])(
    'rejects %j',
    (line) => {
      expect(parseJsonObject(line)).toBeUndefined();
    },
  );

  it('parses an object', () => {
    expect(parseJsonObject('{"a":1}')).toEqual({ a: 1 });
  });
});

describe('parseJsonlObjects', () => {
  it('skips blank and malformed lines, counting and logging the malformed', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const { entries, skipped } = parseJsonlObjects(
      '{"a":1}\n\n{"torn":\n[2]\n{"b":2}\n',
      'log',
    );
    expect(entries).toEqual([{ a: 1 }, { b: 2 }]);
    expect(skipped).toBe(2);
    expect(debug).toHaveBeenCalledWith(
      '[jsonl] skipped 2 malformed line(s) in log',
    );
  });

  it('logs nothing when every line parses', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    expect(parseJsonlObjects('{"a":1}\n', 'log').skipped).toBe(0);
    expect(debug).not.toHaveBeenCalled();
  });
});

describe('writeFileAtomic', () => {
  it('replaces the file and leaves no temp file', () => {
    writeFileAtomic(file, 'one');
    writeFileAtomic(file, 'two');
    expect(fs.readFileSync(file, 'utf8')).toBe('two');
    expect(fs.readdirSync(path.dirname(file))).toEqual(['log.jsonl']);
  });

  it('leaves the previous content when the write fails', () => {
    writeFileAtomic(file, 'before');
    vi.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
      throw new Error('EPERM');
    });
    expect(() => {
      writeFileAtomic(file, 'after');
    }).toThrow('EPERM');
    expect(fs.readFileSync(file, 'utf8')).toBe('before');
    expect(fs.readdirSync(path.dirname(file))).toEqual(['log.jsonl']);
  });
});
