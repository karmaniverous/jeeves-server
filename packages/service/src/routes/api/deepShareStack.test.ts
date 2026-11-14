/**
 * Deep-share stacks containing `+`: lz-string's URL alphabet includes `+`, which a query string decodes as a space. Links the server writes must carry it percent-encoded, and links already written with a raw `+` must still verify. Real access checks, HMAC keys and a temp tree.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { type FastifyInstance, type FastifyRequest } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { INSIDER_SEED, makeRuntimeConfig } from '../../testing/authFixture.js';
import { testApp } from '../../testing/testApp.js';

const config = makeRuntimeConfig();

/** A path whose one-entry stack compresses to a string containing `+`. */
const PLUS_PATH = '/r/docs/jij11c.md';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'deep-share-plus-'));
fs.mkdirSync(path.join(tmpRoot, 'r', 'docs'), { recursive: true });
fs.writeFileSync(path.join(tmpRoot, 'r', 'docs', 'jij11c.md'), '# Plus\n');

vi.mock('../../config/index.js', () => ({
  getConfig: () => config,
  resetConfig: vi.fn(),
}));

const { addAuthMiddleware: addAccessHook } = await import('./middleware.js');
const { createDeepShare } = await import('../../services/shareLinks.js');
const { encodeStack } = await import('../../services/deepShareLinks.js');
const { computeDeepShareKey } = await import('../../util/crypto.js');

let app: FastifyInstance;

beforeAll(async () => {
  app = testApp();
  addAccessHook(app);
  app.get('/api/file/*', (request: FastifyRequest) => ({
    accessMode: request.accessMode ?? null,
  }));
  await app.ready();
});

afterAll(async () => {
  await app.close();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('deep-share stack with "+"', () => {
  it('is a stack this test can rely on', () => {
    expect(encodeStack([PLUS_PATH])).toContain('+');
  });

  it('is percent-encoded in a link the server writes, which opens', async () => {
    const { url } = createDeepShare(INSIDER_SEED, PLUS_PATH, {
      depth: 1,
      dirs: false,
    });
    expect(url).toContain('%2B');
    expect(url).not.toMatch(/s=[^&]*\+/u);
    const res = await app.inject(url.replace(/^\/browse\//u, '/api/file/'));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ accessMode: 'outsider' });
  });

  it('still opens from a link written with a raw "+"', async () => {
    const s = encodeStack([PLUS_PATH]);
    const k = computeDeepShareKey(INSIDER_SEED, PLUS_PATH, {
      depth: 1,
      dirs: false,
      stack: s,
    });
    const res = await app.inject(
      `/api/file${PLUS_PATH}?k=${k}&d=1&dirs=0&s=${s}`,
    );
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ accessMode: 'outsider' });
  });
});
