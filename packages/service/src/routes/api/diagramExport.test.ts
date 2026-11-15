/**
 * Tests for diagram export route handlers.
 *
 * Validates the cache-first rendering pipeline shared by Mermaid and PlantUML
 * handlers, and the path resolution + error bodies for both routes.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { catalogRoutes } from '../../testing/catalogRoutes.js';
import { serverError, testApp } from '../../testing/testApp.js';

// Mock config before importing the module under test
const tmpDir = path.join(tmpdir(), `diagramExport-test-${String(Date.now())}`);

/** Chrome path for the next test: any existing file passes the check. */
let chromePath = process.execPath;

vi.mock('../../config/index.js', () => ({
  getConfig: () => ({ roots: {}, chromePath }),
}));

vi.mock('../../services/diagramCache.js', () => {
  const cache: Record<string, Buffer> = {};
  return {
    getCachedDiagramBuffer: (engine: string, source: string, format: string) =>
      cache[`${engine}:${source}:${format}`] ?? null,
    cacheDiagramBuffer: (
      engine: string,
      source: string,
      buffer: Buffer,
      format: string,
    ) => {
      cache[`${engine}:${source}:${format}`] = buffer;
    },
  };
});

vi.mock('../../services/mermaid.js', () => ({
  renderMermaidToBuffer: vi.fn(),
}));

vi.mock('../../services/plantuml.js', () => ({
  getPlantUmlFormats: () => ['svg', 'png'],
  renderPlantUmlToBuffer: vi.fn(),
}));

const { diagramExportHandlers } = await import('./diagramExport.js');
const { renderMermaidToBuffer } = await import('../../services/mermaid.js');
const { renderPlantUmlToBuffer } = await import('../../services/plantuml.js');
const platformMod = await import('../../util/platform.js');

let app: FastifyInstance;

beforeEach(async () => {
  fs.mkdirSync(tmpDir, { recursive: true });
  chromePath = process.execPath;
  app = testApp();
  await app.register(catalogRoutes(diagramExportHandlers));
  await app.ready();
});

afterEach(async () => {
  await app.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/** GET a route; status and parsed body. */
async function get(url: string) {
  const res = await app.inject({ method: 'GET', url });
  return { status: res.statusCode, body: res.json<unknown>() };
}

/** Write a diagram source in the temp dir and resolve every path to it. */
function diagramFile(name: string, source: string): void {
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, source);
  vi.spyOn(platformMod, 'urlPathToFs').mockReturnValue(filePath);
}

describe('diagramExportRoutes', () => {
  it.each(['mermaid', 'plantuml'])(
    'answers SERVER_INVALID_PATH when no path is provided (%s)',
    async (engine) => {
      expect(await get(`/api/${engine}-export/`)).toEqual({
        status: 400,
        body: serverError('SERVER_INVALID_PATH', 'Path required'),
      });
    },
  );

  it.each([
    ['mermaid', 'nonexistent.mmd', 'Mermaid file not found'],
    ['plantuml', 'nonexistent.puml', 'PlantUML file not found'],
  ])(
    'answers SERVER_NOT_FOUND for a missing file (%s)',
    async (engine, file, message) => {
      vi.spyOn(platformMod, 'urlPathToFs').mockReturnValue(
        path.join(tmpDir, file),
      );
      expect(await get(`/api/${engine}-export/${file}`)).toEqual({
        status: 404,
        body: serverError('SERVER_NOT_FOUND', message),
      });
    },
  );

  it('answers SERVER_NOT_FOUND for a path under no root', async () => {
    vi.spyOn(platformMod, 'urlPathToFs').mockReturnValue(null);
    expect(await get('/api/mermaid-export/x.mmd')).toEqual({
      status: 404,
      body: serverError('SERVER_NOT_FOUND', 'Not found'),
    });
  });

  it('answers SERVER_EXPORT_FAILED when the mermaid render returns null', async () => {
    diagramFile('test.mmd', 'graph TD; A-->B');
    vi.mocked(renderMermaidToBuffer).mockResolvedValue(null);
    expect(await get('/api/mermaid-export/test.mmd?format=svg')).toEqual({
      status: 502,
      body: serverError('SERVER_EXPORT_FAILED', 'Mermaid render failed'),
    });
  });

  it('answers SERVER_CHROME_UNAVAILABLE for mermaid without Chrome, rendering nothing', async () => {
    chromePath = path.join(tmpDir, 'no-chrome');
    diagramFile('nochrome.mmd', 'graph TD; C-->D');
    expect(await get('/api/mermaid-export/nochrome.mmd?format=svg')).toEqual({
      status: 503,
      body: serverError(
        'SERVER_CHROME_UNAVAILABLE',
        'Export unavailable: Chrome could not be started (check chromePath)',
      ),
    });
    expect(renderMermaidToBuffer).not.toHaveBeenCalled();
  });

  it('answers SERVER_EXPORT_FAILED when the plantuml render returns null', async () => {
    diagramFile('test.puml', '@startuml\nA -> B\n@enduml');
    vi.mocked(renderPlantUmlToBuffer).mockResolvedValue(null);
    expect(await get('/api/plantuml-export/test.puml?format=svg')).toEqual({
      status: 502,
      body: serverError('SERVER_EXPORT_FAILED', 'Plantuml render failed'),
    });
  });

  it('serves PlantUML without Chrome (it renders on a PlantUML server)', async () => {
    chromePath = path.join(tmpDir, 'no-chrome');
    diagramFile('ok.puml', '@startuml\nE -> F\n@enduml');
    vi.mocked(renderPlantUmlToBuffer).mockResolvedValue(Buffer.from('<svg/>'));
    const res = await app.inject({
      method: 'GET',
      url: '/api/plantuml-export/ok.puml?format=svg',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('<svg/>');
  });
});
