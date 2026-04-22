/**
 * Tests for diagram export route handlers.
 *
 * Validates the cache-first rendering pipeline shared by Mermaid and PlantUML
 * handlers, and the path resolution + error handling for both routes.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock config before importing the module under test
const tmpDir = path.join(tmpdir(), `diagramExport-test-${String(Date.now())}`);

vi.mock('../../config/index.js', () => ({
  getConfig: () => ({
    roots: {},
  }),
}));

vi.mock('../../services/diagramCache.js', () => {
  let cache: Record<string, Buffer> = {};
  return {
    getCachedDiagramBuffer: (
      engine: string,
      source: string,
      format: string,
    ) => {
      const key = `${engine}:${source}:${format}`;
      return cache[key] ?? null;
    },
    cacheDiagramBuffer: (
      engine: string,
      source: string,
      buffer: Buffer,
      format: string,
    ) => {
      cache[`${engine}:${source}:${format}`] = buffer;
    },
    _reset: () => {
      cache = {};
    },
  };
});

vi.mock('../../services/mermaid.js', () => ({
  renderMermaidToFile: vi.fn(),
}));

vi.mock('../../services/plantuml.js', () => ({
  getPlantUmlFormats: () => ['svg', 'png'],
  renderPlantUmlToBuffer: vi.fn(),
}));

const { diagramExportRoutes } = await import('./diagramExport.js');
const { renderMermaidToFile } = await import('../../services/mermaid.js');
const { renderPlantUmlToBuffer } = await import('../../services/plantuml.js');

/** Minimal Fastify reply mock that captures sent data. */
function createReplyMock() {
  const headers: Record<string, string> = {};
  let sentData: unknown = null;
  let statusCode = 200;
  const reply = {
    code: (c: number) => {
      statusCode = c;
      return reply;
    },
    header: (key: string, value: string) => {
      headers[key.toLowerCase()] = value;
      return reply;
    },
    send: (data: unknown) => {
      sentData = data;
      return reply;
    },
    get statusCode() {
      return statusCode;
    },
    get headers() {
      return headers;
    },
    get sentData() {
      return sentData;
    },
  };
  return reply;
}

describe('diagramExportRoutes', () => {
  const routes: Record<
    string,
    (
      req: { params: Record<string, string>; query: Record<string, string> },
      reply: ReturnType<typeof createReplyMock>,
    ) => Promise<void>
  > = {};

  beforeEach(async () => {
    fs.mkdirSync(tmpDir, { recursive: true });

    const fakeFastify = {
      get: (
        routePath: string,
        handler: (req: unknown, reply: unknown) => Promise<void>,
      ) => {
        routes[routePath] = handler;
      },
    };

    await diagramExportRoutes(fakeFastify as never, {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('returns 400 when no path is provided for mermaid export', async () => {
    const reply = createReplyMock();
    await routes['/api/mermaid-export/*'](
      { params: { '*': '' }, query: {} },
      reply,
    );
    expect(reply.statusCode).toBe(400);
  });

  it('returns 404 for non-existent mermaid file', async () => {
    const reply = createReplyMock();
    await routes['/api/mermaid-export/*'](
      { params: { '*': 'nonexistent.mmd' }, query: {} },
      reply,
    );
    expect(reply.statusCode).toBe(404);
  });

  it('returns 400 when no path is provided for plantuml export', async () => {
    const reply = createReplyMock();
    await routes['/api/plantuml-export/*'](
      { params: { '*': '' }, query: {} },
      reply,
    );
    expect(reply.statusCode).toBe(400);
  });

  it('returns 404 for non-existent plantuml file', async () => {
    const reply = createReplyMock();
    await routes['/api/plantuml-export/*'](
      { params: { '*': 'nonexistent.puml' }, query: {} },
      reply,
    );
    expect(reply.statusCode).toBe(404);
  });

  it('sends 500 when mermaid render returns null', async () => {
    // Create a real .mmd file
    const mmdPath = path.join(tmpDir, 'test.mmd');
    fs.writeFileSync(mmdPath, 'graph TD; A-->B');

    // Mock urlPathToFs to resolve our temp path
    const platformMod = await import('../../util/platform.js');
    vi.spyOn(platformMod, 'urlPathToFs').mockReturnValue(mmdPath);

    vi.mocked(renderMermaidToFile).mockResolvedValue(null);

    const reply = createReplyMock();
    await routes['/api/mermaid-export/*'](
      { params: { '*': 'test.mmd' }, query: { format: 'svg' } },
      reply,
    );
    expect(reply.statusCode).toBe(500);
    expect((reply.sentData as Record<string, string>).error).toContain(
      'render failed',
    );
  });

  it('sends 500 when plantuml render returns null', async () => {
    const pumlPath = path.join(tmpDir, 'test.puml');
    fs.writeFileSync(pumlPath, '@startuml\nA -> B\n@enduml');

    const platformMod = await import('../../util/platform.js');
    vi.spyOn(platformMod, 'urlPathToFs').mockReturnValue(pumlPath);

    vi.mocked(renderPlantUmlToBuffer).mockResolvedValue(null);

    const reply = createReplyMock();
    await routes['/api/plantuml-export/*'](
      { params: { '*': 'test.puml' }, query: { format: 'svg' } },
      reply,
    );
    expect(reply.statusCode).toBe(500);
    expect((reply.sentData as Record<string, string>).error).toContain(
      'render failed',
    );
  });
});
