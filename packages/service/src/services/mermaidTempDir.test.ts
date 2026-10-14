/**
 * #281: Mermaid file export renders in a private temp dir, never next to
 * the source, and removes the temp dir on success and failure.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runMock = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({ mmdPath: '' }));

vi.mock('@mermaid-js/mermaid-cli', () => ({ run: runMock }));
vi.mock('../config/index.js', () => ({
  getConfig: () => ({ chromePath: 'chrome', roots: {} }),
}));
vi.mock('./diagramCache.js', () => ({
  getCachedDiagramBuffer: () => null,
  cacheDiagramBuffer: vi.fn(),
}));
vi.mock('../util/platform.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getRoots: () => [],
  urlPathToFs: () => state.mmdPath,
}));

const { renderMermaidToBuffer } = await import('./mermaid.js');
const { diagramExportRoutes } = await import('../routes/api/diagramExport.js');

/** Fake mermaid-cli run: writes `rendered-<format>` to the output path. */
function renderOk() {
  runMock.mockImplementation((_in: string, out: string) => {
    fs.writeFileSync(out, `rendered-${path.extname(out)}`);
    return Promise.resolve();
  });
}

let srcDir: string;

beforeEach(() => {
  srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mmd-src-'));
  state.mmdPath = path.join(srcDir, 'x.mmd');
  fs.writeFileSync(state.mmdPath, 'graph TD; A-->B');
  fs.writeFileSync(path.join(srcDir, 'x.svg'), 'hand-edited svg');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  runMock.mockReset();
  vi.restoreAllMocks();
  fs.rmSync(srcDir, { recursive: true, force: true });
});

/** Output path mermaid-cli was asked to write. */
const outputPath = () => (runMock.mock.calls[0] as [string, string])[1];

describe('renderMermaidToBuffer (#281)', () => {
  it.each(['svg', 'png', 'pdf'] as const)(
    '%s renders into a temp dir that is then removed',
    async (format) => {
      renderOk();

      const buffer = await renderMermaidToBuffer(state.mmdPath, format);

      expect(buffer?.toString()).toBe(`rendered-.${format}`);
      const out = outputPath();
      expect(path.dirname(out)).not.toBe(srcDir);
      expect(
        path.resolve(out).startsWith(path.resolve(os.tmpdir()) + path.sep),
      ).toBe(true);
      expect(fs.existsSync(path.dirname(out))).toBe(false);
      expect(fs.readdirSync(srcDir).sort()).toEqual(['x.mmd', 'x.svg']);
      expect(fs.readFileSync(path.join(srcDir, 'x.svg'), 'utf8')).toBe(
        'hand-edited svg',
      );
    },
  );

  it('removes the temp dir and returns null when the render fails', async () => {
    runMock.mockImplementation((_in: string, out: string) => {
      fs.writeFileSync(out, 'partial');
      return Promise.reject(new Error('boom'));
    });

    expect(await renderMermaidToBuffer(state.mmdPath, 'png')).toBeNull();
    expect(fs.existsSync(path.dirname(outputPath()))).toBe(false);
    expect(fs.readdirSync(srcDir).sort()).toEqual(['x.mmd', 'x.svg']);
  });
});

describe('GET /api/mermaid-export (#281)', () => {
  it('leaves an existing x.svg beside x.mmd byte-identical', async () => {
    renderOk();
    const before = fs.readFileSync(path.join(srcDir, 'x.svg'));
    const app = Fastify();
    await app.register(diagramExportRoutes);

    const res = await app.inject('/api/mermaid-export/r/x.mmd?format=svg');
    await app.close();

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('rendered-.svg');
    expect(fs.readFileSync(path.join(srcDir, 'x.svg')).equals(before)).toBe(
      true,
    );
    expect(fs.readdirSync(srcDir).sort()).toEqual(['x.mmd', 'x.svg']);
  });
});
