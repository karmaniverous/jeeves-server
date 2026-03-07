import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Must set tmpDir before mocks reference it
let tmpDir: string;

vi.mock('../../config/index.js', () => ({
  getConfig: () => ({ roots: {} }),
}));

vi.mock('../../services/plantuml.js', () => ({
  getPlantUmlFormats: () => ['svg', 'png', 'pdf'],
}));

vi.mock('../../util/platform.js', () => ({
  getRoots: () => ({}),
  urlPathToFs: (reqPath: string) => {
    // Simple mock: treat first segment as root name, rest as path
    const parts = reqPath.split('/');
    if (parts[0] === 'test') return path.join(tmpDir, ...parts.slice(1));
    return null;
  },
}));

const { linkInfoRoutes } = await import('./linkInfo.js');

describe('GET /api/link-info', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-linkinfo-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function callHandler(
    urlPath: string,
    accessMode = 'insider',
  ): Promise<Record<string, unknown>> {
    const routes: Record<
      string,
      (req: unknown, reply: unknown) => Promise<unknown>
    > = {};
    const fakeFastify = {
      get: (
        routePath: string,
        handler: (req: unknown, reply: unknown) => Promise<unknown>,
      ) => {
        routes[routePath] = handler;
      },
    };
    await linkInfoRoutes(fakeFastify as never, {});
    const handler = routes['/api/link-info/*'];

    let result: unknown;
    const fakeReply = {
      code: () => ({
        send: (d: unknown) => {
          result = d;
          return d;
        },
      }),
      send: (d: unknown) => {
        result = d;
        return d;
      },
    };
    const fakeRequest = {
      params: { '*': urlPath },
      accessMode,
    };
    await handler(fakeRequest, fakeReply);
    return result as Record<string, unknown>;
  }

  it('returns exists: false for non-existent path', async () => {
    const res = await callHandler('test/doesnotexist.md');
    expect(res).toEqual({ exists: false });
  });

  it('returns directory links with ZIP for insiders', async () => {
    fs.mkdirSync(path.join(tmpDir, 'folder'));
    const res = await callHandler('test/folder');
    expect(res.exists).toBe(true);
    expect(res.isDirectory).toBe(true);
    expect(res.rawUrl).toBe(null);
    expect(res.exportLinks).toEqual([
      { format: 'zip', url: '/api/export/test/folder?format=zip' },
    ]);
  });

  it('omits ZIP for directories if outsider', async () => {
    fs.mkdirSync(path.join(tmpDir, 'folder'));
    const res = await callHandler('test/folder', 'outsider');
    expect(res.exportLinks).toEqual([]);
  });

  it('returns markdown export links (pdf + docx)', async () => {
    fs.writeFileSync(path.join(tmpDir, 'doc.md'), '# hello');
    const res = await callHandler('test/doc.md');
    expect(res.rawUrl).toBe('/api/raw/test/doc.md');
    const links = res.exportLinks as { format: string }[];
    expect(links.map((l) => l.format)).toEqual(['pdf', 'docx']);
  });

  it('returns mermaid export links', async () => {
    fs.writeFileSync(path.join(tmpDir, 'diag.mmd'), 'graph TD; A-->B');
    const res = await callHandler('test/diag.mmd');
    const links = res.exportLinks as { format: string }[];
    expect(links.map((l) => l.format)).toEqual(['svg', 'png', 'pdf']);
  });

  it('returns plantuml export links', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'diag.puml'),
      '@startuml\nA->B\n@enduml',
    );
    const res = await callHandler('test/diag.puml');
    const links = res.exportLinks as { format: string }[];
    expect(links.map((l) => l.format)).toEqual(['svg', 'png', 'pdf']);
  });

  it('returns no export links for plain files', async () => {
    fs.writeFileSync(path.join(tmpDir, 'data.json'), '{}');
    const res = await callHandler('test/data.json');
    expect(res.rawUrl).toBe('/api/raw/test/data.json');
    expect(res.exportLinks).toEqual([]);
  });
});
