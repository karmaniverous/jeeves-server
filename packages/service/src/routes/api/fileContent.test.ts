/**
 * Route tests for GET /api/file/*: response shape per file type, raw mode,
 * and outsider breadcrumb filtering. Rendering services are mocked.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccessMode } from '../../config/types.js';

let tmpDir = '';

vi.mock('../../config/index.js', () => ({ getConfig: () => ({ roots: {} }) }));
vi.mock('../../util/platform.js', () => ({
  getRoots: () => [],
  urlPathToFs: (reqPath: string) => {
    const [root, ...rest] = reqPath.split('/');
    return root === 'j' ? path.join(tmpDir, ...rest) : null;
  },
  breadcrumbParts: () => [
    { label: 'j', path: 'j' },
    { label: 'doc', path: 'j/doc' },
  ],
}));

const renderMarkdownContent = vi.fn();
const tryWatcherRender = vi.fn();
vi.mock('./fileRender.js', () => ({
  renderMarkdownContent: (...a: unknown[]): unknown =>
    renderMarkdownContent(...a),
  tryWatcherRender: (...a: unknown[]): unknown => tryWatcherRender(...a),
}));

const getOrRenderDiagram = vi.fn();
vi.mock('../../services/diagramCache.js', () => ({
  getOrRenderDiagram: (...a: unknown[]): unknown => getOrRenderDiagram(...a),
}));
vi.mock('../../services/mermaid.js', () => ({
  renderMermaidSvg: () => '<svg>mermaid</svg>',
}));
vi.mock('../../services/plantuml.js', () => ({
  renderPlantUmlSvg: () => '<svg>plantuml</svg>',
}));

const { fileContentRoutes } = await import('./fileContent.js');

async function buildApp(accessMode: AccessMode): Promise<FastifyInstance> {
  const app = Fastify();
  app.addHook('preHandler', (request, _reply, done) => {
    request.accessMode = accessMode;
    request.authMatchedPath = '/j/doc';
    done();
  });
  await app.register(fileContentRoutes);
  await app.ready();
  return app;
}

function write(name: string, content: string | Buffer) {
  fs.writeFileSync(path.join(tmpDir, name), content);
}

describe('GET /api/file/*', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-file-'));
    renderMarkdownContent
      .mockReset()
      .mockResolvedValue({ html: '<p>r</p>', headings: [] });
    tryWatcherRender.mockReset().mockResolvedValue(null);
    // Invoke the render callback so the per-type renderer choice is observable.
    getOrRenderDiagram
      .mockReset()
      .mockImplementation((_t: string, _c: string, render: () => string) =>
        render(),
      );
    app = await buildApp('insider');
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const get = async (url: string) => {
    const res = await app.inject({ url });
    return {
      status: res.statusCode,
      body: res.json<Record<string, unknown>>(),
    };
  };

  it.each([
    ['/api/file/x/a.md', 404],
    ['/api/file/j/missing.md', 404],
  ])('%s → %s', async (url, status) => {
    expect((await get(url)).status).toBe(status);
  });

  it('rejects directories with 400', async () => {
    fs.mkdirSync(path.join(tmpDir, 'sub'));
    expect((await get('/api/file/j/sub')).status).toBe(400);
  });

  it('renders markdown with common fields and mtime', async () => {
    write('a.md', '# A');
    const { body } = await get('/api/file/j/a.md');
    expect(body).toMatchObject({
      type: 'markdown',
      content: '# A',
      html: '<p>r</p>',
      headings: [],
      fileName: 'a.md',
      isInsider: true,
    });
    expect(body.breadcrumbs).toHaveLength(2);
    expect(typeof body.mtime).toBe('number');
    expect(renderMarkdownContent.mock.calls[0][0]).toBe('# A');
  });

  it('returns raw markdown without rendering', async () => {
    write('a.md', '# A');
    const { body } = await get('/api/file/j/a.md?raw=1');
    expect(body).toMatchObject({ type: 'markdown', content: '# A' });
    expect(body.html).toBeUndefined();
    expect(renderMarkdownContent).not.toHaveBeenCalled();
  });

  it.each([
    ['d.mmd', 'mermaid', '<svg>mermaid</svg>'],
    ['d.puml', 'plantuml', '<svg>plantuml</svg>'],
  ])('renders %s as %s', async (name, type, html) => {
    write(name, 'graph');
    const { body } = await get(`/api/file/j/${name}`);
    expect(body).toMatchObject({ type, content: 'graph', html });
    expect(getOrRenderDiagram.mock.calls[0][0]).toBe(type);
  });

  it('returns raw diagrams without rendering', async () => {
    write('d.mmd', 'graph');
    const { body } = await get('/api/file/j/d.mmd?raw=1');
    expect(body).toMatchObject({ type: 'mermaid', content: 'graph' });
    expect(getOrRenderDiagram).not.toHaveBeenCalled();
  });

  it('returns SVG source', async () => {
    write('i.svg', '<svg/>');
    expect((await get('/api/file/j/i.svg')).body).toMatchObject({
      type: 'svg',
      content: '<svg/>',
    });
  });

  it('renders CSV as a table, or text when raw', async () => {
    write('t.csv', 'a,b\n1,2');
    const rendered = (await get('/api/file/j/t.csv')).body;
    expect(rendered.type).toBe('csv');
    expect(rendered.html).toContain('<table');
    expect((await get('/api/file/j/t.csv?raw=1')).body).toMatchObject({
      type: 'text',
      content: 'a,b\n1,2',
    });
  });

  it('returns plain text when the watcher has no rendering', async () => {
    write('n.txt', 'hello');
    expect((await get('/api/file/j/n.txt')).body).toMatchObject({
      type: 'text',
      content: 'hello',
    });
  });

  it('renders watcher-converted text as markdown', async () => {
    write('n.json', '{"a":1}');
    tryWatcherRender.mockResolvedValue({
      renderAs: 'md',
      content: '**a**',
      rules: ['json-rule'],
      metadata: {},
    });
    const { body } = await get('/api/file/j/n.json');
    expect(body).toMatchObject({
      type: 'markdown',
      content: '{"a":1}',
      html: '<p>r</p>',
      renderAs: 'md',
      matchedRules: ['json-rule'],
    });
    expect(renderMarkdownContent.mock.calls[0][0]).toBe('**a**');
  });

  it('skips the watcher in raw mode', async () => {
    write('n.json', '{}');
    await get('/api/file/j/n.json?raw=1');
    expect(tryWatcherRender).not.toHaveBeenCalled();
  });

  it('identifies images and binaries', async () => {
    const binary = Buffer.from([0, 1, 2, 0, 255, 0, 3]);
    write('p.png', binary);
    write('b.bin', binary);
    expect((await get('/api/file/j/p.png')).body).toMatchObject({
      type: 'image',
    });
    expect((await get('/api/file/j/b.bin')).body).toMatchObject({
      type: 'binary',
      size: binary.length,
    });
  });

  it('filters breadcrumbs for outsiders', async () => {
    await app.close();
    app = await buildApp('outsider');
    write('a.md', '# A');
    const { body } = await get('/api/file/j/a.md');
    expect(body.isInsider).toBe(false);
    expect(body.breadcrumbs).not.toHaveLength(2);
  });
});
