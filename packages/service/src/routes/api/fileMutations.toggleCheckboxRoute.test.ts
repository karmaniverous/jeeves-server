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
      expect(reply.sentData).toHaveProperty('code', 'SERVER_INVALID_REQUEST');
      const err = (reply.sentData as { message: string }).message;
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
