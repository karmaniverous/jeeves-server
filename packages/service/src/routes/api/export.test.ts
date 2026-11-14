import type * as JeevesModule from '@karmaniverous/jeeves';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    statSync: vi.fn(),
  },
}));

vi.mock('@karmaniverous/jeeves', async (importOriginal) => ({
  ...(await importOriginal<typeof JeevesModule>()),
  getBindAddress: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('../../config/index.js', () => ({
  getConfig: vi.fn().mockReturnValue({
    roots: { j: '/data/j' },
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
  getRoots: vi.fn().mockReturnValue({ j: '/data/j' }),
  urlPathToFs: vi.fn(),
}));

const fs = (await import('node:fs')).default;
const { urlPathToFs } = await import('../../util/platform.js');

const mockedFs = vi.mocked(fs);
const mockedUrlPathToFs = vi.mocked(urlPathToFs);

/** Call the export handler. */
async function exportGet(
  reqPath: string,
  query: object,
  accessMode = 'insider',
) {
  const { exportHandlers } = await import('./export.js');
  return exportHandlers.export({ params: { '*': reqPath }, query, body: {} }, {
    accessMode,
  } as never);
}

describe('exportHandlers.export — directory archive format validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['pdf', 'docx'])(
    'rejects %s format for directories with SERVER_EXPORT_UNSUPPORTED',
    async (format) => {
      mockedUrlPathToFs.mockReturnValue('/data/j/docs');
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as never);

      await expect(exportGet('j/docs', { format })).rejects.toMatchObject({
        statusCode: 400,
        code: 'SERVER_EXPORT_UNSUPPORTED',
        message: 'Directories only support zip or tar export',
      });
    },
  );

  it('requires insider access for archive export', async () => {
    mockedUrlPathToFs.mockReturnValue('/data/j/docs');
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as never);

    await expect(
      exportGet('j/docs', { format: 'zip' }, 'outsider'),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'SERVER_INSIDER_REQUIRED',
      message: 'Archive export requires insider access',
    });
  });

  it('answers SERVER_NOT_FOUND for non-existent paths', async () => {
    mockedUrlPathToFs.mockReturnValue('/data/j/missing');
    mockedFs.existsSync.mockReturnValue(false);

    await expect(
      exportGet('j/missing', { format: 'pdf' }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'SERVER_NOT_FOUND',
      message: 'Not found',
    });
  });

  it('answers SERVER_INVALID_PATH when path is missing', async () => {
    await expect(exportGet('', {})).rejects.toMatchObject({
      statusCode: 400,
      code: 'SERVER_INVALID_PATH',
      message: 'Path required',
    });
  });
});
