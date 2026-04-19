import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { toggleCheckbox } from './fileMutations.js';

// ─── Pure function tests (ported from toggleCheckbox.test.ts) ───

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

// ─── Route-level tests ───

vi.mock('../../config/index.js', () => ({
  getConfig: vi.fn(() => ({ roots: {} })),
}));

let mockFsPath: string | null = null;
vi.mock('../../util/platform.js', () => ({
  getRoots: vi.fn(() => []),
  urlPathToFs: vi.fn(() => mockFsPath),
}));

type Reply = ReturnType<typeof createReply>;
type Handler = (
  request: Record<string, unknown>,
  reply: Reply,
) => Promise<unknown>;

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

async function setupRoute(): Promise<Handler> {
  const { fileMutationRoutes } = await import('./fileMutations.js');
  let handler: Handler | undefined;

  const mockFastify = {
    post: (_path: string, h: Handler) => {
      handler = h;
    },
  };

  await fileMutationRoutes(mockFastify as never, {});
  return handler!;
}

describe('fileMutationRoutes', () => {
  let tmpDir: string;
  let testFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-mutations-'));
    testFile = path.join(tmpDir, 'test.md');
    mockFsPath = testFile;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── CRLF handling ──

  it('normalizes CRLF line endings to LF on edit', async () => {
    fs.writeFileSync(testFile, '# Title\r\nParagraph\r\nEnd\r\n');
    const handler = await setupRoute();
    const reply = createReply();

    await handler(
      {
        accessMode: 'insider',
        params: { '*': 'any/test.md' },
        body: {
          action: 'edit-block',
          startLine: 2,
          endLine: 2,
          content: 'Updated\n',
        },
      },
      reply,
    );

    expect(reply.sentData).toHaveProperty('ok', true);
    const result = fs.readFileSync(testFile, 'utf8');
    // File should be written with LF only, no \r remaining
    expect(result).not.toContain('\r');
    expect(result).toBe('# Title\nUpdated\nEnd\n');
  });

  // ── Auth & Validation ──

  it('rejects outsiders with 403', async () => {
    fs.writeFileSync(testFile, '# Test\n');
    const handler = await setupRoute();
    const reply = createReply();

    await handler(
      {
        accessMode: 'outsider',
        params: { '*': 'any/test.md' },
        body: {
          action: 'edit-block',
          startLine: 1,
          endLine: 1,
          content: '# New\n',
        },
      },
      reply,
    );

    expect(reply.statusCode).toBe(403);
  });

  it('rejects non-.md files with 400', async () => {
    const handler = await setupRoute();
    const reply = createReply();

    await handler(
      {
        accessMode: 'insider',
        params: { '*': 'any/test.txt' },
        body: {
          action: 'edit-block',
          startLine: 1,
          endLine: 1,
          content: '# New\n',
        },
      },
      reply,
    );

    expect(reply.statusCode).toBe(400);
    expect(reply.sentData).toHaveProperty('error');
    expect((reply.sentData as { error: string }).error).toContain('.md');
  });

  it('rejects unknown action with 400', async () => {
    fs.writeFileSync(testFile, '# Test\n');
    const handler = await setupRoute();
    const reply = createReply();

    await handler(
      {
        accessMode: 'insider',
        params: { '*': 'any/test.md' },
        body: { action: 'unknown-action' },
      },
      reply,
    );

    expect(reply.statusCode).toBe(400);
  });

  // ── Non-existent file ──

  it('edit-block on non-existent file returns 404', async () => {
    mockFsPath = path.join(tmpDir, 'does-not-exist.md');
    const handler = await setupRoute();
    const reply = createReply();

    await handler(
      {
        accessMode: 'insider',
        params: { '*': 'any/does-not-exist.md' },
        body: {
          action: 'edit-block',
          startLine: 1,
          endLine: 1,
          content: 'Hello\n',
        },
      },
      reply,
    );

    expect(reply.statusCode).toBe(404);
    expect((reply.sentData as { error: string }).error).toBe('File not found');
  });

  it('delete-block on non-existent file returns 404', async () => {
    mockFsPath = path.join(tmpDir, 'does-not-exist.md');
    const handler = await setupRoute();
    const reply = createReply();

    await handler(
      {
        accessMode: 'insider',
        params: { '*': 'any/does-not-exist.md' },
        body: { action: 'delete-block', startLine: 1, endLine: 1 },
      },
      reply,
    );

    expect(reply.statusCode).toBe(404);
    expect((reply.sentData as { error: string }).error).toBe('File not found');
  });

  // ── edit-block ──

  describe('edit-block', () => {
    it('replaces a single line', async () => {
      fs.writeFileSync(testFile, '# Title\nParagraph one\nParagraph two\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: {
            action: 'edit-block',
            startLine: 2,
            endLine: 2,
            content: 'Updated line\n',
          },
        },
        reply,
      );

      expect(reply.sentData).toHaveProperty('ok', true);
      const result = fs.readFileSync(testFile, 'utf8');
      expect(result).toContain('Updated line');
      expect(result).not.toContain('Paragraph one');
    });

    it('replaces a multi-line range', async () => {
      fs.writeFileSync(testFile, 'Line 1\nLine 2\nLine 3\nLine 4\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: {
            action: 'edit-block',
            startLine: 2,
            endLine: 3,
            content: 'New A\nNew B\n',
          },
        },
        reply,
      );

      expect(reply.sentData).toHaveProperty('ok', true);
      const result = fs.readFileSync(testFile, 'utf8');
      const lines = result.split('\n');
      expect(lines[0]).toBe('Line 1');
      expect(lines[1]).toBe('New A');
      expect(lines[2]).toBe('New B');
      expect(lines[3]).toBe('Line 4');
    });

    it('strips trailing newline from content', async () => {
      fs.writeFileSync(testFile, 'Line 1\nLine 2\nLine 3\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: {
            action: 'edit-block',
            startLine: 2,
            endLine: 2,
            content: 'Replaced\n',
          },
        },
        reply,
      );

      expect(reply.sentData).toHaveProperty('ok', true);
      const result = fs.readFileSync(testFile, 'utf8');
      // The trailing \n from content is stripped so it doesn't produce an extra blank line
      expect(result).toBe('Line 1\nReplaced\nLine 3\n');
    });

    it('rejects startLine > endLine', async () => {
      fs.writeFileSync(testFile, 'Line 1\nLine 2\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: {
            action: 'edit-block',
            startLine: 3,
            endLine: 1,
            content: 'x\n',
          },
        },
        reply,
      );

      expect(reply.statusCode).toBe(400);
    });

    it('rejects empty content', async () => {
      fs.writeFileSync(testFile, 'Line 1\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: { action: 'edit-block', startLine: 1, endLine: 1, content: '' },
        },
        reply,
      );

      expect(reply.statusCode).toBe(400);
    });

    it('rejects out-of-range lines', async () => {
      fs.writeFileSync(testFile, 'Only one line\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: {
            action: 'edit-block',
            startLine: 1,
            endLine: 10,
            content: 'x\n',
          },
        },
        reply,
      );

      expect(reply.statusCode).toBe(400);
    });
  });

  // ── delete-block ──

  describe('delete-block', () => {
    it('deletes a single line', async () => {
      fs.writeFileSync(testFile, 'Line 1\nLine 2\nLine 3\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: { action: 'delete-block', startLine: 2, endLine: 2 },
        },
        reply,
      );

      expect(reply.sentData).toHaveProperty('ok', true);
      const result = fs.readFileSync(testFile, 'utf8');
      expect(result).not.toContain('Line 2');
      expect(result).toContain('Line 1');
      expect(result).toContain('Line 3');
    });

    it('deletes a range of lines', async () => {
      fs.writeFileSync(testFile, 'Line 1\nLine 2\nLine 3\nLine 4\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: { action: 'delete-block', startLine: 2, endLine: 3 },
        },
        reply,
      );

      expect(reply.sentData).toHaveProperty('ok', true);
      const result = fs.readFileSync(testFile, 'utf8');
      const lines = result.split('\n').filter(Boolean);
      expect(lines).toEqual(['Line 1', 'Line 4']);
    });

    it('deletes all lines (valid)', async () => {
      fs.writeFileSync(testFile, 'Only line\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: { action: 'delete-block', startLine: 1, endLine: 1 },
        },
        reply,
      );

      expect(reply.sentData).toHaveProperty('ok', true);
    });

    it('rejects startLine > endLine', async () => {
      fs.writeFileSync(testFile, 'Line 1\nLine 2\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: { action: 'delete-block', startLine: 2, endLine: 1 },
        },
        reply,
      );

      expect(reply.statusCode).toBe(400);
    });

    it('rejects out-of-range lines', async () => {
      fs.writeFileSync(testFile, 'Line 1\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: { action: 'delete-block', startLine: 1, endLine: 5 },
        },
        reply,
      );

      expect(reply.statusCode).toBe(400);
    });
  });

  // ── insert-block ──

  describe('insert-block', () => {
    it('inserts content before a line', async () => {
      fs.writeFileSync(testFile, '# Title\nParagraph\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: {
            action: 'insert-block',
            atLine: 2,
            position: 'before',
            content: 'New block\n',
          },
        },
        reply,
      );

      expect(reply.sentData).toHaveProperty('ok', true);
      const result = fs.readFileSync(testFile, 'utf8');
      expect(result).toContain('New block');
      // Should have blank line separator between existing content
      const lines = result.split('\n');
      const newIdx = lines.indexOf('New block');
      expect(newIdx).toBeGreaterThan(0);
    });

    it('inserts content after a line', async () => {
      fs.writeFileSync(testFile, '# Title\nParagraph\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: {
            action: 'insert-block',
            atLine: 1,
            position: 'after',
            content: 'New block\n',
          },
        },
        reply,
      );

      expect(reply.sentData).toHaveProperty('ok', true);
      const result = fs.readFileSync(testFile, 'utf8');
      expect(result).toContain('New block');
    });

    it('inserts at file start without leading blank line', async () => {
      fs.writeFileSync(testFile, '# Title\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: {
            action: 'insert-block',
            atLine: 1,
            position: 'before',
            content: 'Prepended\n',
          },
        },
        reply,
      );

      expect(reply.sentData).toHaveProperty('ok', true);
      const result = fs.readFileSync(testFile, 'utf8');
      // First line should be the inserted content (no leading blank)
      expect(result.startsWith('Prepended')).toBe(true);
      // But there should be a blank line before existing content
      expect(result).toContain('Prepended\n\n# Title');
    });

    it('inserts at file end without trailing blank line', async () => {
      fs.writeFileSync(testFile, '# Title\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: {
            action: 'insert-block',
            atLine: 1,
            position: 'after',
            content: 'Appended\n',
          },
        },
        reply,
      );

      expect(reply.sentData).toHaveProperty('ok', true);
      const result = fs.readFileSync(testFile, 'utf8');
      // Should have blank line between existing and new, but no trailing blank
      expect(result).toContain('# Title\n\nAppended');
    });

    it('collapses existing blank lines at boundary', async () => {
      fs.writeFileSync(testFile, '# Title\n\nParagraph\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: {
            action: 'insert-block',
            atLine: 1,
            position: 'after',
            content: 'Inserted\n',
          },
        },
        reply,
      );

      expect(reply.sentData).toHaveProperty('ok', true);
      const result = fs.readFileSync(testFile, 'utf8');
      // The blank line already exists between Title and Paragraph, so
      // we insert after line 1 (Title). Adjacent is blank line, no extra added.
      expect(result).not.toContain('\n\n\n');
    });

    it('table-row context: no blank-line separators', async () => {
      fs.writeFileSync(testFile, '| A | B |\n|---|---|\n| 1 | 2 |\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: {
            action: 'insert-block',
            atLine: 3,
            position: 'after',
            content: '| 3 | 4 |\n',
            context: 'table-row',
          },
        },
        reply,
      );

      expect(reply.sentData).toHaveProperty('ok', true);
      const result = fs.readFileSync(testFile, 'utf8');
      // No blank lines inserted
      expect(result).toBe('| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n');
    });

    it('inserts into empty file', async () => {
      fs.writeFileSync(testFile, '');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: {
            action: 'insert-block',
            atLine: 1,
            position: 'before',
            content: '# New file\n',
          },
        },
        reply,
      );

      expect(reply.sentData).toHaveProperty('ok', true);
      const result = fs.readFileSync(testFile, 'utf8');
      expect(result).toContain('# New file');
    });

    it('rejects invalid position value', async () => {
      fs.writeFileSync(testFile, '# Title\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: {
            action: 'insert-block',
            atLine: 1,
            position: 'middle',
            content: 'x\n',
          },
        },
        reply,
      );

      expect(reply.statusCode).toBe(400);
      expect((reply.sentData as { error: string }).error).toContain('position');
    });

    it('rejects out-of-range atLine', async () => {
      fs.writeFileSync(testFile, 'Line 1\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: {
            action: 'insert-block',
            atLine: 99,
            position: 'before',
            content: 'x\n',
          },
        },
        reply,
      );

      expect(reply.statusCode).toBe(400);
    });
  });

  // ── edit-cell ──

  describe('edit-cell', () => {
    it('edits a table cell', async () => {
      fs.writeFileSync(
        testFile,
        '| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |\n',
      );
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: { action: 'edit-cell', line: 3, col: 1, content: 'Updated' },
        },
        reply,
      );

      expect(reply.sentData).toHaveProperty('ok', true);
      const result = fs.readFileSync(testFile, 'utf8');
      expect(result).toContain('| Updated |');
      expect(result).toContain('| 1 |');
      expect(result).toContain('| 3 |');
    });

    it('handles escaped pipes in cells', async () => {
      fs.writeFileSync(testFile, '| A\\|B | C |\n|---|---|\n| 1\\|2 | 3 |\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: { action: 'edit-cell', line: 3, col: 0, content: 'X\\|Y' },
        },
        reply,
      );

      expect(reply.sentData).toHaveProperty('ok', true);
      const result = fs.readFileSync(testFile, 'utf8');
      const lines = result.split('\n');
      // The cell should contain the escaped pipe
      expect(lines[2]).toContain('X\\|Y');
      // Second cell should be unchanged
      expect(lines[2]).toContain('| 3 |');
    });

    it('rejects out-of-range column', async () => {
      fs.writeFileSync(testFile, '| A | B |\n|---|---|\n| 1 | 2 |\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: { action: 'edit-cell', line: 3, col: 5, content: 'x' },
        },
        reply,
      );

      expect(reply.statusCode).toBe(400);
    });

    it('rejects out-of-range line', async () => {
      fs.writeFileSync(testFile, '| A |\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: { action: 'edit-cell', line: 99, col: 0, content: 'x' },
        },
        reply,
      );

      expect(reply.statusCode).toBe(400);
    });

    it('escapes unescaped pipes in user content', async () => {
      fs.writeFileSync(testFile, '| A | B |\n|---|---|\n| 1 | 2 |\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: { action: 'edit-cell', line: 3, col: 0, content: 'X|Y' },
        },
        reply,
      );

      expect(reply.sentData).toHaveProperty('ok', true);
      const result = fs.readFileSync(testFile, 'utf8');
      const lines = result.split('\n');
      // Bare pipe should be escaped
      expect(lines[2]).toContain('X\\|Y');
      // Table structure should remain intact (3 pipes for 2 columns)
      expect(lines[2].match(/(?<!\\)\|/g)?.length).toBe(3);
    });

    it('rejects editing a separator row', async () => {
      fs.writeFileSync(testFile, '| A | B |\n|---|---|\n| 1 | 2 |\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: { action: 'edit-cell', line: 2, col: 0, content: 'Nope' },
        },
        reply,
      );

      expect(reply.statusCode).toBe(400);
      expect((reply.sentData as { error: string }).error).toContain(
        'separator',
      );
    });

    it('rejects editing a separator row with alignment colons', async () => {
      fs.writeFileSync(testFile, '| A | B |\n| :---: | ---: |\n| 1 | 2 |\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: { action: 'edit-cell', line: 2, col: 0, content: 'Nope' },
        },
        reply,
      );

      expect(reply.statusCode).toBe(400);
      expect((reply.sentData as { error: string }).error).toContain(
        'separator',
      );
    });

    it('handles GFM table without leading/trailing pipes', async () => {
      fs.writeFileSync(testFile, 'A | B | C\n---|---|---\n1 | 2 | 3\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: { action: 'edit-cell', line: 3, col: 1, content: 'Updated' },
        },
        reply,
      );

      expect(reply.sentData).toHaveProperty('ok', true);
      const result = fs.readFileSync(testFile, 'utf8');
      const lines = result.split('\n');
      expect(lines[2]).toContain('Updated');
      // Should not have added leading/trailing pipes
      expect(lines[2]).not.toMatch(/^\|/);
    });
  });

  // ── toggle-checkbox ──

  describe('toggle-checkbox', () => {
    it('flips an unchecked checkbox to checked', async () => {
      fs.writeFileSync(testFile, '- [ ] todo\n- [x] done\n- [ ] later\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: { action: 'toggle-checkbox', index: 0, checked: true },
        },
        reply,
      );

      expect(reply.sentData).toHaveProperty('ok', true);
      const updated = fs.readFileSync(testFile, 'utf8');
      expect(updated).toContain('[x] todo');
    });

    it('flips a checked checkbox to unchecked', async () => {
      fs.writeFileSync(testFile, '- [ ] todo\n- [x] done\n- [ ] later\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: { action: 'toggle-checkbox', index: 1, checked: false },
        },
        reply,
      );

      expect(reply.sentData).toHaveProperty('ok', true);
      const updated = fs.readFileSync(testFile, 'utf8');
      expect(updated).toContain('[ ] done');
    });

    it('returns 400 for out-of-range index', async () => {
      fs.writeFileSync(testFile, '- [ ] only one\n');
      const handler = await setupRoute();
      const reply = createReply();

      await handler(
        {
          accessMode: 'insider',
          params: { '*': 'any/test.md' },
          body: { action: 'toggle-checkbox', index: 5, checked: true },
        },
        reply,
      );

      expect(reply.statusCode).toBe(400);
      expect(reply.sentData).toHaveProperty('error');
      const err = (reply.sentData as { error: string }).error;
      expect(err).toContain('out of range');
    });
  });

  // ── Concurrent write serialization ──

  describe('mutex serialization', () => {
    it('serializes concurrent writes to the same file', async () => {
      fs.writeFileSync(testFile, '- [ ] a\n- [ ] b\n- [ ] c\n');
      const handler = await setupRoute();

      // Fire three concurrent toggles
      const promises = [0, 1, 2].map((index) => {
        const reply = createReply();
        return handler(
          {
            accessMode: 'insider',
            params: { '*': 'any/test.md' },
            body: { action: 'toggle-checkbox', index, checked: true },
          },
          reply,
        ).then(() => reply);
      });

      const replies = await Promise.all(promises);
      for (const r of replies) {
        expect(r.sentData).toHaveProperty('ok', true);
      }

      const result = fs.readFileSync(testFile, 'utf8');
      expect(result).toBe('- [x] a\n- [x] b\n- [x] c\n');
    });
  });
});
