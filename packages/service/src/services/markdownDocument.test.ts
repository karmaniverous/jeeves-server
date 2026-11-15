/**
 * Tests for the Markdown document loader: native `.md`/`.markdown`,
 * watcher `md`, watcher non-md, unrendered and binary files, the watcher
 * down (null, or 502 for export), title resolution, content hash,
 * directives and the once-per-file debug log.
 *
 * @packageDocumentation
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WatcherRenderOutcome } from './watcherRender.js';

const renderViaWatcher = vi.hoisted(() =>
  vi.fn<(p: string) => Promise<WatcherRenderOutcome>>(),
);
vi.mock('./watcherRender.js', () => ({ renderViaWatcher }));
const config = vi.hoisted((): { branding?: { name: string } } => ({
  branding: { name: 'Brand' },
}));
vi.mock('../config/index.js', () => ({ getConfig: () => config }));

const { documentTitle, isNativeMarkdown, loadMarkdownDocument } =
  await import('./markdownDocument.js');

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const rendered = (renderAs: string, content: string): WatcherRenderOutcome => ({
  status: 'rendered',
  data: { renderAs, content, rules: ['brief'], metadata: {} },
});

let dir = '';
function write(name: string, content: string | Buffer): string {
  const file = path.join(dir, name);
  fs.writeFileSync(file, content);
  return file;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-doc-'));
  renderViaWatcher.mockReset().mockResolvedValue({ status: 'none' });
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('loadMarkdownDocument', () => {
  it.each(['a.md', 'b.markdown', 'C.MD', 'd.Markdown'])(
    'loads %s natively without the watcher',
    async (name) => {
      const source = '---\ntitle: Native\njeeves:\n  print: x\n---\n# H\n';
      const doc = await loadMarkdownDocument(write(name, source));
      expect(doc).toMatchObject({
        origin: 'native',
        source,
        body: '# H\n',
        directives: { print: 'x' },
        title: 'Native',
        contentHash: sha256(source),
      });
      expect(doc?.frontMatter.display).toBe('title: Native');
      expect(doc).not.toHaveProperty('renderAs');
      expect(renderViaWatcher).not.toHaveBeenCalled();
    },
  );

  it('loads a watcher md rendering of a text file', async () => {
    const md = '---\njeeves:\n  print: bca-brief\n---\n# Brief\n';
    renderViaWatcher.mockResolvedValue(rendered('md', md));
    const file = write('industry.json', '{"a":1}');
    const doc = await loadMarkdownDocument(file);
    expect(renderViaWatcher).toHaveBeenCalledWith(file);
    expect(doc).toMatchObject({
      origin: 'watcher',
      source: md,
      directives: { print: 'bca-brief' },
      title: 'industry.json',
      contentHash: sha256(md),
      renderAs: 'md',
      matchedRules: ['brief'],
    });
  });

  it.each<[string, WatcherRenderOutcome]>([
    ['a non-md rendering', rendered('html', '<p/>')],
    ['no rendering', { status: 'none' }],
    ['an unreachable watcher', { status: 'unreachable', error: new Error() }],
  ])('answers null for %s', async (_kind, outcome) => {
    renderViaWatcher.mockResolvedValue(outcome);
    await expect(
      loadMarkdownDocument(write('x.json', '{}')),
    ).resolves.toBeNull();
  });

  it('throws SERVER_WATCHER_UNAVAILABLE when export needs the watcher', async () => {
    const error = new Error('down');
    renderViaWatcher.mockResolvedValue({ status: 'unreachable', error });
    await expect(
      loadMarkdownDocument(write('x.json', '{}'), { requireWatcher: true }),
    ).rejects.toMatchObject({
      statusCode: 502,
      code: 'SERVER_WATCHER_UNAVAILABLE',
      message: 'Watcher unreachable',
      cause: error,
    });
  });

  it('answers null for unrendered files, even when the watcher is required', async () => {
    await expect(
      loadMarkdownDocument(write('x.json', '{}'), { requireWatcher: true }),
    ).resolves.toBeNull();
  });

  it.each(['f.mmd', 'f.puml', 'f.svg', 'f.csv'])(
    'never sends %s (rendered by the file API) to the watcher',
    async (name) => {
      await expect(loadMarkdownDocument(write(name, 'x'))).resolves.toBeNull();
      expect(renderViaWatcher).not.toHaveBeenCalled();
    },
  );

  it('never sends binary files to the watcher', async () => {
    const file = write('b.bin', Buffer.from([1, 0, 2]));
    await expect(loadMarkdownDocument(file)).resolves.toBeNull();
    expect(renderViaWatcher).not.toHaveBeenCalled();
  });

  it('logs a non-mapping jeeves once per file at debug', async () => {
    const debug = vi
      .spyOn(console, 'debug')
      .mockImplementation(() => undefined);
    const file = write('n.md', '---\njeeves: brief\n---\n');
    const doc = await loadMarkdownDocument(file);
    await loadMarkdownDocument(file);
    expect(doc?.directives).toBeNull();
    expect(doc?.frontMatter.display).toBe('jeeves: brief');
    expect(debug).toHaveBeenCalledOnce();
    expect(debug.mock.calls[0][0]).toContain(file);
  });
});

describe('documentTitle', () => {
  it.each<[string, Record<string, unknown> | null, string]>([
    ['a front-matter title', { title: 'Brief' }, 'Brief'],
    ['a blank title', { title: '  ' }, 'f.md'],
    ['a non-string title', { title: 7 }, 'f.md'],
    ['no front matter', null, 'f.md'],
  ])('uses %s', (_kind, data, title) => {
    expect(documentTitle(data, 'f.md')).toBe(title);
  });

  it('falls back to the brand name, then the default brand', () => {
    expect(documentTitle(null, '')).toBe('Brand');
    config.branding = undefined;
    expect(documentTitle(null, '')).toBe('Jeeves Server');
    config.branding = { name: 'Brand' };
  });
});

describe('isNativeMarkdown', () => {
  it.each([
    ['/a/b.md', true],
    ['/a/b.MARKDOWN', true],
    ['/a/b.mdx', false],
    ['/a/md', false],
  ])('%s → %s', (p, expected) => {
    expect(isNativeMarkdown(p)).toBe(expected);
  });
});
