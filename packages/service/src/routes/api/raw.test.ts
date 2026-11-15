/**
 * Route tests for GET /api/raw/* downloads (#316): `?download=1` (or
 * `true`) makes any type an attachment with RFC 6266 file names, without it
 * inline types stay inline and others download as before; with an insider
 * key and with share keys (`k`, `exp`, deep `d`). Real HMAC keys through the
 * access hook.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  INSIDER_SEED,
  MACHINE_SEED,
  makeRuntimeConfig,
} from '../../testing/authFixture.js';
import { catalogRoutes } from '../../testing/catalogRoutes.js';
import { testApp } from '../../testing/testApp.js';
import {
  computeDeepShareKey,
  computeInsiderKey,
  computeOutsiderKeyWithExpiry,
  computePathKey,
} from '../../util/crypto.js';
import type * as Platform from '../../util/platform.js';

const tmp = vi.hoisted(() => ({ dir: '' }));
const config = makeRuntimeConfig();
vi.mock('../../config/index.js', () => ({ getConfig: () => config }));
vi.mock('../../util/platform.js', async (importOriginal) => ({
  ...(await importOriginal<typeof Platform>()),
  getRoots: () => [],
  urlPathToFs: (reqPath: string) => {
    const [root, ...rest] = reqPath.replace(/^\/+/, '').split('/');
    return root === 'r' ? path.join(tmp.dir, ...rest) : null;
  },
}));

const { addAccessHook } = await import('../../api/accessHook.js');
const { rawHandlers } = await import('./raw.js');
const { encodeStack } = await import('../../services/deepShareStack.js');

/** Non-ASCII names, with characters RFC 5987 encodes (', (, )). */
const NAMES = {
  pdf: "Brief – 2026 'final' (v1).pdf",
  json: 'daten-ü.json',
  png: 'bild ä.png',
  txt: 'notes é.txt',
} as const;
const FALLBACK = {
  pdf: "Brief _ 2026 'final' (v1).pdf",
  json: 'daten-_.json',
  png: 'bild _.png',
  txt: 'notes _.txt',
} as const;
const ENCODED = {
  pdf: 'Brief%20%E2%80%93%202026%20%27final%27%20%28v1%29.pdf',
  json: 'daten-%C3%BC.json',
  png: 'bild%20%C3%A4.png',
  txt: 'notes%20%C3%A9.txt',
} as const;
type Kind = keyof typeof NAMES;
const KINDS = Object.keys(NAMES) as Kind[];

const urlPath = (kind: Kind) => `/r/${NAMES[kind]}`;
const rawUrl = (kind: Kind, query: string) =>
  `/api/raw/r/${encodeURIComponent(NAMES[kind])}?${query}`;
const insiderKey = computeInsiderKey(MACHINE_SEED);
const attachment = (kind: Kind) =>
  `attachment; filename="${FALLBACK[kind]}"; filename*=UTF-8''${ENCODED[kind]}`;

let app: FastifyInstance;

beforeAll(async () => {
  tmp.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-raw-'));
  for (const kind of KINDS)
    fs.writeFileSync(path.join(tmp.dir, NAMES[kind]), kind);
  fs.writeFileSync(path.join(tmp.dir, 'pack ü.zip'), 'zip');
  app = testApp();
  addAccessHook(app);
  await app.register(catalogRoutes(rawHandlers));
  await app.ready();
});

afterAll(async () => {
  await app.close();
  fs.rmSync(tmp.dir, { recursive: true, force: true });
});

const get = async (url: string) => {
  const res = await app.inject(url);
  return {
    status: res.statusCode,
    disposition: res.headers['content-disposition'],
    body: res.body,
  };
};

describe('GET /api/raw/* downloads (#316)', () => {
  it.each(KINDS)(
    'download=1 sends %s as an attachment with both file names',
    async (kind) => {
      const res = await get(rawUrl(kind, `download=1&k=${insiderKey}`));
      expect(res.status).toBe(200);
      expect(res.body).toBe(kind);
      expect(res.disposition).toBe(attachment(kind));
    },
  );

  it('accepts download=true', async () => {
    const res = await get(rawUrl('json', `download=true&k=${insiderKey}`));
    expect(res.disposition).toBe(attachment('json'));
  });

  it.each(KINDS)('without download, %s stays inline', async (kind) => {
    const res = await get(rawUrl(kind, `k=${insiderKey}`));
    expect(res.status).toBe(200);
    expect(res.disposition).toBeUndefined();
  });

  it.each(['0', 'yes', ''])('download=%j is no download', async (value) => {
    const res = await get(rawUrl('pdf', `download=${value}&k=${insiderKey}`));
    expect(res.disposition).toBeUndefined();
  });

  it('downloads a non-inline type without the parameter, in the same form', async () => {
    const res = await get(
      `/api/raw/r/${encodeURIComponent('pack ü.zip')}?k=${insiderKey}`,
    );
    expect(res.disposition).toBe(
      `attachment; filename="pack _.zip"; filename*=UTF-8''pack%20%C3%BC.zip`,
    );
  });

  it('downloads with a path share key, plain and expiring', async () => {
    const plain = computePathKey(INSIDER_SEED, urlPath('pdf'));
    expect(
      (await get(rawUrl('pdf', `download=1&k=${plain}`))).disposition,
    ).toBe(attachment('pdf'));
    const exp = String(Date.now() + 3_600_000);
    const expiring = computeOutsiderKeyWithExpiry(
      INSIDER_SEED,
      urlPath('pdf'),
      exp,
    );
    const res = await get(rawUrl('pdf', `k=${expiring}&exp=${exp}&download=1`));
    expect(res.status).toBe(200);
    expect(res.disposition).toBe(attachment('pdf'));
  });

  it('downloads with a deep share key', async () => {
    const stack = encodeStack([urlPath('txt')]);
    const k = computeDeepShareKey(INSIDER_SEED, urlPath('txt'), {
      depth: 1,
      dirs: false,
      stack,
    });
    const res = await get(
      rawUrl(
        'txt',
        `k=${k}&d=1&dirs=0&s=${encodeURIComponent(stack)}&download=1`,
      ),
    );
    expect(res.status).toBe(200);
    expect(res.disposition).toBe(attachment('txt'));
  });

  it('still refuses a bad key with download=1', async () => {
    const res = await get(rawUrl('pdf', `download=1&k=${'0'.repeat(32)}`));
    expect(res.status).toBe(401);
  });
});
