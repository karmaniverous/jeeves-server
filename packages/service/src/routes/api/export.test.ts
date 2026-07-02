import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    statSync: vi.fn(),
  },
}));

vi.mock('@karmaniverous/jeeves', () => ({
  getBindAddress: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('../../config/index.js', () => ({
  getConfig: vi.fn().mockReturnValue({
    roots: { j: '/data/j' },
    maxZipSizeMb: 100,
    port: 1934,
    sessionSecret: 'test-secret',
  }),
}));

vi.mock('../../services/eventQueue.js', () => ({
  appendEvent: vi.fn(),
}));

vi.mock('../../services/export.js', () => ({
  exportPage: vi.fn(),
}));

vi.mock('../../services/exportCache.js', () => ({
  cacheExport: vi.fn(),
  clearDiagramCacheForFile: vi.fn(),
  clearExportCache: vi.fn(),
  clearStandaloneDiagramCache: vi.fn(),
  getCachedExport: vi.fn(),
}));

vi.mock('../../util/platform.js', () => ({
  getDirSize: vi.fn(),
  getRoots: vi.fn().mockReturnValue({ j: '/data/j' }),
  urlPathToFs: vi.fn(),
}));

const fs = (await import('node:fs')).default;
const { urlPathToFs } = await import('../../util/platform.js');

const mockedFs = vi.mocked(fs);
const mockedUrlPathToFs = vi.mocked(urlPathToFs);

// Capture registered routes
type RouteHandler = (
  request: Record<string, unknown>,
  reply: Record<string, unknown>,
) => Promise<unknown>;

const registeredRoutes: Record<string, RouteHandler> = {};

const mockFastify = {
  get: (path: string, ...args: unknown[]) => {
    const handler = args[args.length - 1] as RouteHandler;
    registeredRoutes[`GET ${path}`] = handler;
  },
  delete: (path: string, ...args: unknown[]) => {
    const handler = args[args.length - 1] as RouteHandler;
    registeredRoutes[`DELETE ${path}`] = handler;
  },
};

function mockReply() {
  const reply: Record<string, unknown> = {};
  reply.code = vi.fn().mockReturnValue(reply);
  reply.send = vi.fn().mockReturnValue(reply);
  reply.header = vi.fn().mockReturnValue(reply);
  reply.type = vi.fn().mockReturnValue(reply);
  return reply;
}

describe('exportRoutes — directory archive format validation', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    for (const key of Object.keys(registeredRoutes)) {
      registeredRoutes[key] = undefined as never;
    }
    const { exportRoutes } = await import('./export.js');
    exportRoutes(mockFastify as never, {}, () => {});
  });

  it('rejects unsupported format for directories with 400', async () => {
    mockedUrlPathToFs.mockReturnValue('/data/j/docs');
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as never);

    const reply = mockReply();
    await registeredRoutes['GET /api/export/*'](
      {
        params: { '*': 'j/docs' },
        query: { format: 'pdf' },
        accessMode: 'insider',
      },
      reply,
    );

    expect(reply.code).toHaveBeenCalledWith(400);
    const sendArg = vi.mocked(reply.send as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as { error?: string } | undefined;
    expect(sendArg?.error).toContain('zip or tar');
  });

  it('rejects docx format for directories with 400', async () => {
    mockedUrlPathToFs.mockReturnValue('/data/j/docs');
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as never);

    const reply = mockReply();
    await registeredRoutes['GET /api/export/*'](
      {
        params: { '*': 'j/docs' },
        query: { format: 'docx' },
        accessMode: 'insider',
      },
      reply,
    );

    expect(reply.code).toHaveBeenCalledWith(400);
  });

  it('requires insider access for archive export', async () => {
    mockedUrlPathToFs.mockReturnValue('/data/j/docs');
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as never);

    const reply = mockReply();
    await registeredRoutes['GET /api/export/*'](
      {
        params: { '*': 'j/docs' },
        query: { format: 'zip' },
        accessMode: 'outsider',
      },
      reply,
    );

    expect(reply.code).toHaveBeenCalledWith(403);
    const sendArg = vi.mocked(reply.send as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as { error?: string } | undefined;
    expect(sendArg?.error).toContain('insider');
  });

  it('returns 404 for non-existent paths', async () => {
    mockedUrlPathToFs.mockReturnValue('/data/j/missing');
    mockedFs.existsSync.mockReturnValue(false);

    const reply = mockReply();
    await registeredRoutes['GET /api/export/*'](
      {
        params: { '*': 'j/missing' },
        query: { format: 'pdf' },
        accessMode: 'insider',
      },
      reply,
    );

    expect(reply.code).toHaveBeenCalledWith(404);
  });

  it('returns 400 when path is missing', async () => {
    const reply = mockReply();
    await registeredRoutes['GET /api/export/*'](
      {
        params: { '*': '' },
        query: {},
        accessMode: 'insider',
      },
      reply,
    );

    expect(reply.code).toHaveBeenCalledWith(400);
  });
});
