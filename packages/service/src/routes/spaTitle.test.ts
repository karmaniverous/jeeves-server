/**
 * Tests for page titles in the SPA shell (#262): the browse path of a page
 * URL, HTML-escaped `<title>`/`og:title` injection, and the SPA fallback
 * (gated pages get the title; out-of-scope, missing and ungated ones don't;
 * a slow watcher falls back to the file name within the budget).
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SpaAccess } from '../auth/resolve.js';
import type { NormalizedScopes } from '../config/types.js';
import { encodeUrlPath, fsPathToUrl, getRoots } from '../util/platform.js';

const access = vi.hoisted((): { current: SpaAccess } => ({
  current: { type: 'none' },
}));
vi.mock('../auth/resolve.js', () => ({
  resolveSpaAccess: () => access.current,
}));
const config = vi.hoisted(
  (): {
    roots: Record<string, string>;
    authModes: string[];
    branding: { name: string };
  } => ({
    roots: {},
    authModes: ['keys'],
    branding: { name: 'Acme' },
  }),
);
vi.mock('../config/index.js', () => ({ getConfig: () => config }));
const renderViaWatcher = vi.hoisted(() => vi.fn());
vi.mock('../services/watcherRender.js', () => ({ renderViaWatcher }));

const { browsePathOf, injectPageTitle } = await import('./spaTitle.js');
const { registerSpa } = await import('./spa.js');

const SHELL =
  '<!doctype html><html><head><meta charset="UTF-8" /><title>Jeeves Server</title></head><body></body></html>';

describe('browsePathOf', () => {
  it.each([
    ['/browse/j/a%20b.md?k=x', '/j/a b.md'],
    ['/browse/j/dir/', '/j/dir'],
    ['/browse/j', '/j'],
  ])('reads %s as %s', (url, expected) => {
    expect(browsePathOf(url)).toBe(expected);
  });

  it.each([
    '/browse',
    '/browse/',
    '/runner/x',
    '/browse/j/%E0%A4%A',
    '/browse/j/../secret.md',
    '/browse/j/%2E%2E/secret.md',
    '/browse/j/./a.md',
    '/browse/j/a%5C..%5Cb.md',
  ])('names no path for %s', (url) => {
    expect(browsePathOf(url)).toBeNull();
  });
});

describe('injectPageTitle', () => {
  it('replaces <title> and adds og:title, HTML-escaped', () => {
    const html = injectPageTitle(SHELL, 'A <b>&"\'', 'Acme & Co');
    expect(html).toContain(
      '<title>A &lt;b&gt;&amp;&quot;&#39; - Acme &amp; Co</title>',
    );
    expect(html).toContain(
      '<meta property="og:title" content="A &lt;b&gt;&amp;&quot;&#39;" />',
    );
    expect(html).not.toContain('Jeeves Server');
  });

  it('adds both to a head without <title>', () => {
    const html = injectPageTitle('<html><head></head></html>', '$& x');
    expect(html).toBe(
      '<html><head><title>$&amp; x - Jeeves Server</title><meta property="og:title" content="$&amp; x" /></head></html>',
    );
  });
});

describe('SPA fallback titles', () => {
  let contentDir = '';
  let clientDir = '';
  const app = Fastify();
  const pageUrl = (file: string, query = '') =>
    '/browse' +
    encodeUrlPath(fsPathToUrl(file, getRoots(config.roots))) +
    query;
  const write = (name: string, content: string) => {
    const file = path.join(contentDir, name);
    fs.writeFileSync(file, content);
    return file;
  };
  const get = async (url: string) => {
    const res = await app.inject({ method: 'GET', url });
    return { status: res.statusCode, body: res.body };
  };

  beforeEach(async () => {
    contentDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-spa-')),
    );
    clientDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-client-'));
    fs.writeFileSync(path.join(clientDir, 'index.html'), SHELL);
    config.roots = { r: contentDir };
    access.current = { type: 'insider', scopes: null };
    renderViaWatcher.mockReset().mockResolvedValue({ status: 'none' });
    if (!app.hasRoute({ method: 'GET', url: '/browse/*' }))
      await registerSpa(app, clientDir);
  });

  afterEach(() => {
    vi.useRealTimers();
    fs.rmSync(contentDir, { recursive: true, force: true });
  });

  it("puts a gated document's front-matter title in the shell", async () => {
    const file = write('brief.md', '---\ntitle: Daily <Brief>\n---\n# x\n');
    const res = await get(pageUrl(file, '?k=abc'));
    expect(res.status).toBe(200);
    expect(res.body).toContain('<title>Daily &lt;Brief&gt; - Acme</title>');
    expect(res.body).toContain(
      '<meta property="og:title" content="Daily &lt;Brief&gt;" />',
    );
  });

  it('uses the file name of a file that is no document', async () => {
    const file = write('ünïcode data.bin', '\u0000\u0001');
    const res = await get(pageUrl(file));
    expect(res.body).toContain('<title>ünïcode data.bin - Acme</title>');
  });

  it('falls back to the file name within the budget when the watcher is slow', async () => {
    renderViaWatcher.mockReturnValue(new Promise(() => undefined));
    const file = write('brief.json', '{"a":1}');
    const started = Date.now();
    const res = await get(pageUrl(file));
    expect(Date.now() - started).toBeLessThan(3000);
    expect(res.body).toContain('<title>brief.json - Acme</title>');
  });

  it('serves the shell unchanged for a missing path', async () => {
    const res = await get(pageUrl(path.join(contentDir, 'missing.md')));
    expect(res.body).toBe(SHELL);
  });

  it('serves the shell unchanged outside the caller’s scopes', async () => {
    const file = write('secret.md', '---\ntitle: Secret\n---\n');
    const scopes: NormalizedScopes = {
      allow: ['/nowhere/**'],
      deny: [],
      explicitAllow: [],
      explicitDeny: [],
    };
    access.current = { type: 'insider', scopes };
    const res = await get(pageUrl(file));
    expect(res.body).toBe(SHELL);
  });

  it('serves the sign-in page, without the title, to a request that fails the gate', async () => {
    const file = write('secret.md', '---\ntitle: Secret\n---\n');
    access.current = { type: 'none' };
    const res = await get(pageUrl(file));
    expect(res.status).toBe(200);
    expect(res.body).not.toContain('Secret');
  });
});
