import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createReply, setupRoute } from './fileMutations.testHelpers.js';

vi.mock('../../config/index.js', () => ({
  getConfig: vi.fn(() => ({ roots: {} })),
}));

let mockFsPath: string | null = null;
vi.mock('../../util/platform.js', () => ({
  getRoots: vi.fn(() => []),
  urlPathToFs: vi.fn(() => mockFsPath),
}));

describe('fileMutationHandlers.fileMutate', () => {
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
      expect((reply.sentData as { message: string }).message).toContain(
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
      expect((reply.sentData as { message: string }).message).toContain(
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
});
