import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { toggleCheckbox } from './toggleCheckbox.js';

describe('toggleCheckbox (pure function)', () => {
  it('checks an unchecked checkbox', () => {
    const result = toggleCheckbox('- [ ] first\n- [ ] second', 0, true);
    expect(result).not.toBeNull();
    expect(result!.result).toBe('- [x] first\n- [ ] second');
    expect(result!.total).toBe(2);
  });

  it('unchecks a checked checkbox', () => {
    const result = toggleCheckbox('- [x] first\n- [x] second', 1, false);
    expect(result).not.toBeNull();
    expect(result!.result).toBe('- [x] first\n- [ ] second');
  });

  it('returns null for out-of-range index', () => {
    expect(toggleCheckbox('- [ ] only', 5, true)).toBeNull();
  });

  it('returns null for negative index', () => {
    expect(toggleCheckbox('- [ ] only', -1, true)).toBeNull();
  });

  it('preserves surrounding content unchanged', () => {
    const content = '# Title\n\nSome text\n\n- [ ] task\n\nMore text\n';
    const result = toggleCheckbox(content, 0, true);
    expect(result).not.toBeNull();
    expect(result!.result).toBe(
      '# Title\n\nSome text\n\n- [x] task\n\nMore text\n',
    );
  });

  it('flips only the targeted checkbox among many', () => {
    const content = '- [ ] a\n- [ ] b\n- [x] c\n- [ ] d\n';
    const result = toggleCheckbox(content, 2, false);
    expect(result).not.toBeNull();
    expect(result!.result).toBe('- [ ] a\n- [ ] b\n- [ ] c\n- [ ] d\n');
    expect(result!.total).toBe(4);
  });

  it('handles uppercase [X]', () => {
    const result = toggleCheckbox('- [X] done', 0, false);
    expect(result).not.toBeNull();
    expect(result!.result).toBe('- [ ] done');
  });

  it('does not count [ ] inside a link as a checkbox', () => {
    const content = 'See [this link][ ] for info\n- [ ] real task\n';
    const result = toggleCheckbox(content, 0, true);
    expect(result).not.toBeNull();
    expect(result!.total).toBe(1);
    expect(result!.result).toBe(
      'See [this link][ ] for info\n- [x] real task\n',
    );
  });

  it('does not count [ ] in plain text as a checkbox', () => {
    const content = 'The array[x] syntax\n- [ ] actual task\n';
    const result = toggleCheckbox(content, 0, true);
    expect(result).not.toBeNull();
    expect(result!.total).toBe(1);
    expect(result!.result).toContain('- [x] actual task');
  });

  it('matches checkboxes with * and + list markers', () => {
    const content = '* [ ] star item\n+ [ ] plus item\n';
    const result = toggleCheckbox(content, 0, true);
    expect(result).not.toBeNull();
    expect(result!.total).toBe(2);
    expect(result!.result).toBe('* [x] star item\n+ [ ] plus item\n');
  });

  it('matches checkboxes with ordered list markers', () => {
    const content = '1. [ ] first\n2. [x] second\n';
    const result = toggleCheckbox(content, 1, false);
    expect(result).not.toBeNull();
    expect(result!.total).toBe(2);
    expect(result!.result).toBe('1. [ ] first\n2. [ ] second\n');
  });

  it('matches indented checkboxes', () => {
    const content = '  - [ ] indented task\n';
    const result = toggleCheckbox(content, 0, true);
    expect(result).not.toBeNull();
    expect(result!.result).toBe('  - [x] indented task\n');
  });
});

// Route-level tests using mocked platform utilities
vi.mock('../../config/index.js', () => ({
  getConfig: vi.fn(() => ({ roots: {} })),
}));

let mockFsPath: string | null = null;
vi.mock('../../util/platform.js', () => ({
  getRoots: vi.fn(() => []),
  urlPathToFs: vi.fn(() => mockFsPath),
}));

describe('toggleCheckboxRoutes', () => {
  let tmpDir: string;
  let testFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-toggle-'));
    testFile = path.join(tmpDir, 'test.md');
    mockFsPath = testFile;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function setupRoute() {
    const { toggleCheckboxRoutes } = await import('./toggleCheckbox.js');
    type Handler = (
      request: Record<string, unknown>,
      reply: ReturnType<typeof createReply>,
    ) => Promise<unknown>;
    let handler: Handler | undefined;

    const mockFastify = {
      post: (_path: string, h: Handler) => {
        handler = h;
      },
    };

    await toggleCheckboxRoutes(mockFastify as never, {});
    return handler!;
  }

  function createReply() {
    let statusCode = 200;
    let sentData: unknown = null;
    const reply = {
      code: (c: number) => {
        statusCode = c;
        return reply;
      },
      send: (data: unknown) => {
        sentData = data;
        return reply;
      },
      get statusCode() {
        return statusCode;
      },
      get sentData() {
        return sentData;
      },
    };
    return reply;
  }

  it('flips an unchecked checkbox to checked (happy path)', async () => {
    fs.writeFileSync(testFile, '- [ ] todo\n- [x] done\n- [ ] later\n');
    const mtime = fs.statSync(testFile).mtimeMs;
    const handler = await setupRoute();
    const reply = createReply();

    await handler(
      {
        accessMode: 'insider',
        params: { '*': 'any/test.md' },
        body: { index: 0, checked: true, mtime },
      },
      reply,
    );

    expect(reply.sentData).toHaveProperty('ok', true);
    expect(reply.sentData).toHaveProperty('mtime');
    const updated = fs.readFileSync(testFile, 'utf8');
    expect(updated).toContain('[x] todo');
  });

  it('flips a checked checkbox to unchecked', async () => {
    fs.writeFileSync(testFile, '- [ ] todo\n- [x] done\n- [ ] later\n');
    const mtime = fs.statSync(testFile).mtimeMs;
    const handler = await setupRoute();
    const reply = createReply();

    await handler(
      {
        accessMode: 'insider',
        params: { '*': 'any/test.md' },
        body: { index: 1, checked: false, mtime },
      },
      reply,
    );

    expect(reply.sentData).toHaveProperty('ok', true);
    const updated = fs.readFileSync(testFile, 'utf8');
    expect(updated).toContain('[ ] done');
  });

  it('returns 409 on stale mtime', async () => {
    fs.writeFileSync(testFile, '- [ ] todo\n');
    const staleMtime = fs.statSync(testFile).mtimeMs - 10000;
    const handler = await setupRoute();
    const reply = createReply();

    await handler(
      {
        accessMode: 'insider',
        params: { '*': 'any/test.md' },
        body: { index: 0, checked: true, mtime: staleMtime },
      },
      reply,
    );

    expect(reply.statusCode).toBe(409);
    expect(reply.sentData).toHaveProperty('conflict', true);
    expect(reply.sentData).toHaveProperty('mtime');
  });

  it('rejects outsiders with 403', async () => {
    fs.writeFileSync(testFile, '- [ ] todo\n');
    const handler = await setupRoute();
    const reply = createReply();

    await handler(
      {
        accessMode: 'outsider',
        params: { '*': 'any/test.md' },
        body: { index: 0, checked: true, mtime: Date.now() },
      },
      reply,
    );

    expect(reply.statusCode).toBe(403);
  });

  it('returns 400 for out-of-range index', async () => {
    fs.writeFileSync(testFile, '- [ ] only one\n');
    const mtime = fs.statSync(testFile).mtimeMs;
    const handler = await setupRoute();
    const reply = createReply();

    await handler(
      {
        accessMode: 'insider',
        params: { '*': 'any/test.md' },
        body: { index: 5, checked: true, mtime },
      },
      reply,
    );

    expect(reply.statusCode).toBe(400);
    expect(reply.sentData).toHaveProperty('error');
    const err = (reply.sentData as { error: string }).error;
    expect(err).toContain('out of range');
  });
});
