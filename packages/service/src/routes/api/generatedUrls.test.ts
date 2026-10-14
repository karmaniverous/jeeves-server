/**
 * #279 regression: every URL the server generates carries its auth key as
 * `k` and uses no query parameter name that OpenClaw masks in model-visible
 * tool output (which would truncate links before agents can relay them).
 *
 * @packageDocumentation
 */

import * as cheerio from 'cheerio';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Page } from 'puppeteer-core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { INSIDER_SEED, makeRuntimeConfig } from '../../testing/authFixture.js';
import { computeInsiderKey } from '../../util/crypto.js';

const config = makeRuntimeConfig();

vi.mock('../../config/index.js', () => ({
  getConfig: () => config,
  resetConfig: vi.fn(),
}));
vi.mock('../../services/eventQueue.js', () => ({ appendEvent: vi.fn() }));
vi.mock('../../util/configPersist.js', () => ({
  writeInsiderSeedToConfig: vi.fn(),
}));

const { sharingRoutes } = await import('./sharing.js');
const { keysRoute } = await import('../keys.js');
const { buildRenderUrl } = await import('./export.js');
const { rewriteLinksForDeepShare, rewriteSimpleImageAuth } =
  await import('../../services/deepShareLinks.js');
const { setupAuthInterception } = await import('../../services/puppeteer.js');

/**
 * Query parameter names OpenClaw (2026.9.6) masks in tool output
 * (`SENSITIVE_URL_QUERY_PARAM_NAMES`), plus its `*_token` pattern.
 */
const OPENCLAW_SENSITIVE = new Set([
  'token',
  'key',
  'api_key',
  'apikey',
  'secret',
  'access_token',
  'auth_token',
  'password',
  'pass',
  'passwd',
  'auth',
  'jwt',
  'session',
  'id_token',
  'code',
  'client_secret',
  'app_secret',
  'hook_token',
  'refresh_token',
  'signature',
  'x_amz_signature',
  'x_amz_security_token',
  'private_key',
  'credential',
  'authorization',
  'sig',
  'x_api_key',
  'x_access_token',
  'x_auth_token',
]);
const SENSITIVE_TOKEN_RE = /(?:^|_)token(?:_[a-f0-9]{16,})?$/u;

/** Query parameter names of a (possibly relative) URL. */
function paramNames(url: string): string[] {
  return [...new URL(url, 'http://h').searchParams.keys()];
}

/**
 * Problems that would stop an agent relaying `url`: a missing `k` key, or
 * any query parameter name OpenClaw masks. Empty when the URL is safe.
 */
function agentProblems(url: string): string[] {
  const names = paramNames(url);
  const problems = names.includes('k') ? [] : [`${url}: no k parameter`];
  for (const name of names) {
    const lower = name.toLowerCase();
    if (OPENCLAW_SENSITIVE.has(lower) || SENSITIVE_TOKEN_RE.test(lower))
      problems.push(`${url}: sensitive parameter ${name}`);
  }
  return problems;
}

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  app.addHook('preHandler', (request, _reply, done) => {
    request.authSeed = INSIDER_SEED;
    request.insiderScopes = null;
    done();
  });
  await app.register(sharingRoutes);
  await app.register(keysRoute);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

const share = async (payload: Record<string, unknown>) =>
  (await app.inject({ method: 'POST', url: '/api/share', payload })).json<{
    url: string;
  }>().url;

describe('generated URLs use k and no OpenClaw-sensitive names', () => {
  it.each([
    ['plain', { path: '/r/a.md' }],
    ['expiring', { path: '/r/a.md', expiry: '9999999999999' }],
    ['deep', { path: '/r/a.md', depth: 2 }],
    ['deep with dirs and expiry', { path: '/r/d', dirs: true, expiry: '9' }],
  ])('/api/share %s', async (_label, payload) => {
    expect(agentProblems(await share(payload))).toEqual([]);
  });

  it.each([0, 2])('/api/util/share-for (depth %i)', async (depth) => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/util/share-for',
      payload: { path: '/r/a.md', insiders: ['outsider@x.com'], depth },
    });
    expect(agentProblems(res.json<{ url: string }>().url)).toEqual([]);
  });

  it.each([
    ['plain', ''],
    ['expiring', '&exp=9999999999999'],
  ])('GET /share %s', async (_label, exp) => {
    const res = await app.inject(
      `/share?path=/r/a.md&k=${computeInsiderKey(INSIDER_SEED)}${exp}`,
    );
    expect(agentProblems(res.json<{ url: string }>().url)).toEqual([]);
  });

  it('deep link rewriting and image auth', () => {
    const html = rewriteLinksForDeepShare(
      '<a href="b.md">b</a><img src="/api/raw/r/i.png">',
      INSIDER_SEED,
      '/r/a.md',
      2,
      false,
      '',
      '9',
    );
    const $ = cheerio.load(html, null, false);
    expect(agentProblems($('a').attr('href') ?? '')).toEqual([]);
    expect(agentProblems($('img').attr('src') ?? '')).toEqual([]);
  });

  it('simple image auth', () => {
    const html = rewriteSimpleImageAuth(
      '<img src="/api/raw/r/i.png">',
      INSIDER_SEED,
    );
    const $ = cheerio.load(html, null, false);
    expect(agentProblems($('img').attr('src') ?? '')).toEqual([]);
  });

  it('export render URL', () => {
    expect(
      agentProblems(buildRenderUrl('127.0.0.1', 1934, 'r/a.md', 'abc')),
    ).toEqual([]);
  });

  it('Puppeteer sub-resource interception', async () => {
    const handlers: ((req: unknown) => void)[] = [];
    const continued: (string | undefined)[] = [];
    const page = {
      setRequestInterception: () => Promise.resolve(),
      on: (_event: string, handler: (req: unknown) => void) => {
        handlers.push(handler);
      },
    } as unknown as Page;
    await setupAuthInterception(page, 'abc', 'http://127.0.0.1:1934/browse/x');
    handlers[0]?.({
      url: () => 'http://127.0.0.1:1934/api/raw/r/i.png',
      continue: (opts?: { url?: string }) => {
        continued.push(opts?.url);
        return Promise.resolve();
      },
    });
    expect(agentProblems(continued[0] ?? '')).toEqual([]);
  });
});
