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
});
