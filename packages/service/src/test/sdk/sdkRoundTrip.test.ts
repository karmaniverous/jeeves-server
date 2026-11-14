// @vitest-environment node
/**
 * The SDK against the real app (`registerServerApp` over the wire corpus, through an `inject`-backed `fetch`): a call per catalog entry, binary entries as bytes, share and session credentials, and response errors as `ServerError`s with the server's code and status.
 */

import path from 'node:path';

import { SERVER_CATALOG } from '@karmaniverous/jeeves-server-core';
import {
  type ServerClient,
  type ServerEntryName,
  toRawUrl,
  withShareCredential,
} from '@karmaniverous/jeeves-server-sdk';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { startWireApp, type WireApp } from '../wire/wireApp.js';
import {
  CACHED_EXPORT,
  CACHED_SVG,
  EMBEDDED_HASH,
  WIRE_CORPUS,
} from '../wire/wireFixture.js';
import { failure, SDK_BASE_URL, SDK_KEYS, sdkClient } from './sdkHarness.js';

let wire: WireApp;
let admin: ServerClient;
let root: string;

/** Entries a test below called, checked against the catalog at the end. */
const called = new Set<ServerEntryName>();

/** Record entries as called. */
const calls = (...names: ServerEntryName[]) => {
  for (const name of names) called.add(name);
};

beforeAll(async () => {
  wire = await startWireApp();
  admin = sdkClient(wire.app, { key: SDK_KEYS.admin });
  root = wire.rootUrl.slice(1);
});

beforeEach(() => {
  wire.reset();
});

afterAll(async () => {
  await wire.close();
});

describe('SDK round trip: service entries', () => {
  it('status, health, config and configApply', async () => {
    calls('status', 'health', 'config', 'configApply');
    await expect(admin.status()).resolves.toMatchObject({
      name: 'server',
      status: expect.any(String) as string,
    });
    await expect(admin.health()).resolves.toEqual({ ok: true });
    await expect(admin.config({ path: '$.port' })).resolves.toEqual({
      result: [1934],
      count: 1,
    });
    await expect(
      admin.configApply({ patch: { eventTimeoutMs: 1000 } }),
    ).resolves.toMatchObject({ applied: true });
  });

  it('auth status, magic link and the key exchange', async () => {
    calls('authStatus', 'sendMagicLink', 'pathKey', 'insiderKey');
    await expect(admin.authStatus()).resolves.toMatchObject({
      authenticated: false,
    });
    await expect(
      admin.sendMagicLink({ email: 'stranger@wire.test' }),
    ).resolves.toBeTypeOf('object');
    // The SDK sends no machine seed (X-API-Key): these refuse it.
    for (const call of [
      () => admin.pathKey({ path: `/${root}/doc.md` }),
      () => admin.insiderKey(),
    ])
      await expect(failure(call())).resolves.toMatchObject({
        status: 401,
        code: 'SERVER_UNAUTHORIZED',
      });
  });
});

describe('SDK round trip: content entries', () => {
  it('drives, browse, file content, link info and public content', async () => {
    calls('drives', 'browse', 'fileContent', 'linkInfo', 'publicContent');
    const drives = await admin.drives();
    expect(drives.length).toBeGreaterThan(0);
    await expect(
      admin.browse({ '*': `${root}/sub dir` }),
    ).resolves.toMatchObject({ entries: expect.any(Array) as unknown[] });
    await expect(
      admin.fileContent({ '*': `${root}/doc.md` }),
    ).resolves.toMatchObject({ type: 'markdown' });
    await expect(
      admin.linkInfo({ '*': `${root}/doc.md` }),
    ).resolves.toMatchObject({ exists: true });
    await expect(
      admin.publicContent({ slug: 'readme' }),
    ).resolves.toMatchObject({ type: 'markdown' });
  });

  it('writes, mutates and clears the export cache', async () => {
    calls('fileWrite', 'fileMutate', 'exportCacheClear');
    await expect(
      admin.fileWrite({ '*': `${root}/notes.markdown`, content: '# New\n' }),
    ).resolves.toMatchObject({ size: 6 });
    await expect(
      admin.fileMutate({
        '*': `${root}/doc.md`,
        action: 'toggle-checkbox',
        index: 0,
        checked: true,
      }),
    ).resolves.toEqual({ ok: true });
    await expect(
      admin.exportCacheClear({ '*': `${root}/doc.md` }),
    ).resolves.toMatchObject({ cleared: { exports: 2 } });
  });

  it('returns bytes for the binary entries', async () => {
    calls('raw', 'export', 'exportMermaid', 'exportPlantUml', 'diagram');
    const png = await admin.raw({ '*': `${root}/image.png` });
    expect(Buffer.from(png).equals(WIRE_CORPUS['image.png'] as Buffer)).toBe(
      true,
    );
    const pdf = await admin.export({ '*': `${root}/doc.md`, format: 'pdf' });
    expect(Buffer.from(pdf).equals(CACHED_EXPORT)).toBe(true);
    const svg = await admin.exportMermaid({ '*': `${root}/flow.mmd` });
    expect(Buffer.from(svg).toString()).toBe(CACHED_SVG);
    // Rendering embedded.md registers its diagram.
    await admin.fileContent({ '*': `${root}/embedded.md` });
    const diagram = await admin.diagram({
      type: 'mermaid',
      hash: EMBEDDED_HASH,
    });
    expect(Buffer.from(diagram).toString()).toBe(CACHED_SVG);
    // No PlantUML renderer is reachable: the error keeps its code.
    await expect(
      failure(admin.exportPlantUml({ '*': `${root}/seq.puml` })),
    ).resolves.toMatchObject({ status: 502, code: 'SERVER_EXPORT_FAILED' });
  });
});

describe('SDK round trip: credentials', () => {
  it('reads through a share credential, and its raw URL', async () => {
    calls('share');
    const { url } = await admin.share({ path: `/${root}/public/shared.md` });
    const params = new URL(url, SDK_BASE_URL).searchParams;
    const share = { k: params.get('k') ?? '' };
    const outsider = sdkClient(wire.app, { share });
    await expect(
      outsider.fileContent({ '*': `${root}/public/shared.md` }),
    ).resolves.toMatchObject({ type: 'markdown' });
    const raw = await outsider.raw({ '*': `${root}/public/shared.md` });
    expect(Buffer.from(raw).toString()).toBe(WIRE_CORPUS['public/shared.md']);
    await expect(
      failure(outsider.fileContent({ '*': `${root}/doc.md` })),
    ).resolves.toMatchObject({ status: 401, code: 'SERVER_UNAUTHORIZED' });

    const rawUrl = new URL(toRawUrl(`${SDK_BASE_URL}${url}`));
    const res = await wire.app.inject({ url: rawUrl.pathname + rawUrl.search });
    expect(res.statusCode).toBe(200);
    const unkeyed = withShareCredential(
      `/api/raw/${root}/public/shared.md?download=1`,
      share,
    );
    const download = await wire.app.inject({ url: unkeyed });
    expect(download.statusCode).toBe(200);
  });

  it('uses a session cookie, and nothing without a credential', async () => {
    const session = sdkClient(wire.app, { session: true });
    await expect(session.config({ path: '$.port' })).resolves.toMatchObject({
      count: 1,
    });
    await expect(failure(sdkClient(wire.app).config())).resolves.toMatchObject({
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    });
    await expect(
      failure(sdkClient(wire.app, { key: SDK_KEYS.scoped }).config()),
    ).resolves.toMatchObject({ status: 403, code: 'SERVER_FORBIDDEN' });
  });
});

describe('SDK round trip: insider entries', () => {
  it('share for, content links, resolve path and rotate key', async () => {
    calls('shareFor', 'contentLink', 'readmeLink', 'resolvePath', 'rotateKey');
    const loginSeed = sdkClient(wire.app, { key: SDK_KEYS.loginSeed });
    await expect(
      loginSeed.shareFor({
        path: `/${root}/doc.md`,
        insiders: ['stranger@wire.test'],
      }),
    ).resolves.toBeDefined();
    await expect(admin.contentLink({ file: 'privacy' })).resolves.toBeDefined();
    await expect(admin.readmeLink()).resolves.toBeDefined();
    await expect(
      admin.resolvePath({ fsPath: path.join(wire.contentDir, 'doc.md') }),
    ).resolves.toMatchObject({ browsePath: `${root}/doc.md` });
    await expect(loginSeed.rotateKey()).resolves.toMatchObject({ ok: true });
    await expect(failure(admin.rotateKey())).resolves.toMatchObject({
      status: 403,
      code: 'SERVER_MACHINE_KEY_NOT_ROTATABLE',
    });
  });

  it('events, search and OAuth', async () => {
    calls('receiveEvent', 'listEvents', 'search', 'searchFacets');
    calls('oauthStart', 'oauthStatus', 'oauthToken');
    await expect(admin.receiveEvent({ kind: 'ping' })).resolves.toBeDefined();
    await expect(admin.listEvents({ limit: '5' })).resolves.toBeDefined();
    for (const call of [
      () => admin.search({ query: 'wire' }),
      () => admin.searchFacets(),
    ])
      await expect(failure(call())).resolves.toMatchObject({
        status: 502,
        code: 'SERVER_WATCHER_UNAVAILABLE',
      });
    await expect(
      admin.oauthStart({
        provider: 'wire',
        account: 'me',
        clientId: 'c',
        clientSecret: 's',
      }),
    ).resolves.toBeDefined();
    const account = { provider: 'wire', account: 'me' };
    await expect(admin.oauthStatus(account)).resolves.toBeDefined();
    await expect(admin.oauthToken(account)).resolves.toMatchObject({
      access_token: 'wire-access-token',
    });
  });

  it('runner pass-through, with the runner unreachable', async () => {
    calls(
      'runnerGet',
      'runnerPost',
      'runnerPatch',
      'runnerPut',
      'runnerDelete',
    );
    const runnerCalls = [
      () => admin.runnerGet({ '*': 'jobs' }),
      () => admin.runnerPost({ '*': 'jobs/x/trigger' }),
      () => admin.runnerPatch({ '*': 'jobs/x' }),
      () => admin.runnerPut({ '*': 'jobs/x' }),
      () => admin.runnerDelete({ '*': 'jobs/x' }),
    ];
    for (const call of runnerCalls)
      await expect(failure(call())).resolves.toMatchObject({
        status: 503,
        code: 'SERVER_RUNNER_UNAVAILABLE',
      });
  });

  it('called every catalog entry', () => {
    expect([...called].sort()).toEqual(
      SERVER_CATALOG.entries.map((e) => e.name).sort(),
    );
  });
});
