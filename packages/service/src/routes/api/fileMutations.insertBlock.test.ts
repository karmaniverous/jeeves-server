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
      expect((reply.sentData as { message: string }).message).toContain(
        'position',
      );
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
});
