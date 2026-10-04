/**
 * Tests for the file content rendering helpers: watcher render proxy and
 * the Markdown pipeline (diagram hashes, embedded diagrams, outsider link
 * rewriting).
 *
 * @packageDocumentation
 */

import type { FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@karmaniverous/jeeves', () => ({
  getServiceUrl: () => 'http://watcher:1936',
}));

const HASH = 'a'.repeat(64);
vi.mock('../../services/markdown.js', () => ({
  parseMarkdown: (src: string) => ({
    html:
      src === 'plain'
        ? '<p>plain</p>'
        : `<p>${src}</p><div data-diagram-hash="${'a'.repeat(64)}"></div>`,
    headings: [{ level: 1, text: 'H', slug: 'h' }],
  }),
}));

const registerDiagramHashes = vi.fn();
vi.mock('../../services/exportCache.js', () => ({
  registerDiagramHashes: (...a: unknown[]): unknown =>
    registerDiagramHashes(...a),
}));

const renderEmbeddedDiagrams = vi.fn();
vi.mock('../../services/embeddedDiagrams.js', () => ({
  setDiagramContext: vi.fn(),
  renderEmbeddedDiagrams: (...a: unknown[]): unknown =>
    renderEmbeddedDiagrams(...a),
}));

const rewriteLinksForDeepShare = vi.fn();
const rewriteSimpleImageAuth = vi.fn();
vi.mock('../../services/deepShareLinks.js', () => ({
  rewriteLinksForDeepShare: (...a: unknown[]): unknown =>
    rewriteLinksForDeepShare(...a),
  rewriteSimpleImageAuth: (...a: unknown[]): unknown =>
    rewriteSimpleImageAuth(...a),
}));

const { renderMarkdownContent, tryWatcherRender } =
  await import('./fileRender.js');

describe('tryWatcherRender', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const respond = (ok: boolean, body: unknown) =>
    fetchMock.mockResolvedValue({ ok, json: () => Promise.resolve(body) });

  it('posts a normalised path and returns matching renders', async () => {
    const data = { renderAs: 'md', content: 'x', rules: ['r'], metadata: {} };
    respond(true, data);
    await expect(tryWatcherRender('J:\\docs\\a.json')).resolves.toEqual(data);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://watcher:1936/render');
    expect(JSON.parse(init.body as string)).toEqual({ path: 'j:/docs/a.json' });
  });

  it('returns null when no rules match', async () => {
    respond(true, { renderAs: 'md', content: '', rules: [], metadata: {} });
    await expect(tryWatcherRender('/a')).resolves.toBeNull();
  });

  it('returns null on a non-OK response', async () => {
    respond(false, {});
    await expect(tryWatcherRender('/a')).resolves.toBeNull();
  });

  it('returns null when the watcher is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(tryWatcherRender('/a')).resolves.toBeNull();
  });
});

describe('renderMarkdownContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    renderEmbeddedDiagrams.mockResolvedValue('<rendered/>');
    rewriteLinksForDeepShare.mockReturnValue('<deep/>');
    rewriteSimpleImageAuth.mockReturnValue('<simple/>');
  });

  const request = (r: Partial<FastifyRequest> & { query?: object }) =>
    ({ query: {}, ...r }) as FastifyRequest;

  it('renders for insiders without link rewriting and registers diagram hashes', async () => {
    const out = await renderMarkdownContent(
      'hi',
      request({ authSeed: 'seed' }),
      '/fs/j/doc/a.md',
      'j/doc/a.md',
      true,
    );
    expect(out.html).toContain('<p>hi</p>');
    expect(out.headings).toHaveLength(1);
    expect(registerDiagramHashes).toHaveBeenCalledWith('/fs/j/doc/a.md', [
      HASH,
    ]);
    expect(rewriteSimpleImageAuth).not.toHaveBeenCalled();
    expect(rewriteLinksForDeepShare).not.toHaveBeenCalled();
  });

  it('skips hash registration when there are no diagrams', async () => {
    await renderMarkdownContent('plain', request({}), '/fs/a.md', 'a.md', true);
    expect(registerDiagramHashes).not.toHaveBeenCalled();
  });

  it('passes a numeric deep-share depth through', async () => {
    await renderMarkdownContent(
      'hi',
      request({
        authSeed: 'seed',
        deepShareParams: { d: '3', dirs: '0', s: 'stk' },
      }),
      '/fs/a.md',
      'j/a.md',
      false,
    );
    const call = rewriteLinksForDeepShare.mock.calls[0] as unknown[];
    expect(call.slice(3, 5)).toEqual([3, false]);
  });

  it('renders embedded diagrams on request', async () => {
    const out = await renderMarkdownContent(
      'hi',
      request({ query: { render_diagrams: '1' } }),
      '/fs/a.md',
      'a.md',
      true,
    );
    expect(out.html).toBe('<rendered/>');
  });

  it('rewrites image auth for simple outsider links', async () => {
    const out = await renderMarkdownContent(
      'hi',
      request({ authSeed: 'seed' }),
      '/fs/a.md',
      'j/a.md',
      false,
    );
    expect(out.html).toBe('<simple/>');
  });

  it('rewrites links for deep outsider shares', async () => {
    const out = await renderMarkdownContent(
      'hi',
      request({
        authSeed: 'seed',
        deepShareParams: { d: 'x', dirs: '1', s: 'stk' },
        query: { exp: '9' },
      }),
      '/fs/a.md',
      'j/a.md',
      false,
    );
    expect(out.html).toBe('<deep/>');
    // Non-numeric depth falls back to 0.
    expect(rewriteLinksForDeepShare).toHaveBeenCalledWith(
      expect.any(String),
      'seed',
      '/j/a.md',
      0,
      true,
      'stk',
      '9',
    );
  });
});
