import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { serverError } from '../../testing/testApp.js';
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
    expect(reply.sentData).toEqual(
      serverError('SERVER_INVALID_REQUEST', 'Only .md files are supported'),
    );
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
    expect((reply.sentData as { message: string }).message).toBe(
      'File not found',
    );
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
    expect((reply.sentData as { message: string }).message).toBe(
      'File not found',
    );
  });
});
