// @vitest-environment node
/**
 * `exportCachePath` (#288): loaded from the config file and used as the
 * export cache directory.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock(import('@karmaniverous/jeeves'), async (importOriginal) => ({
  ...(await importOriginal()),
  getConfigRoot: () => configRoot,
}));

let configRoot = '';

import { cacheExport, initExportCache } from '../services/exportCache.js';
import { loadConfig } from './index.js';

let tmpDir: string;

const configWith = (extra: object): string => {
  const file = path.join(tmpDir, 'jeeves-server.config.json');
  fs.writeFileSync(
    file,
    JSON.stringify({
      chromePath: '/usr/bin/chromium',
      auth: { modes: ['keys'] },
      keys: { primary: 'a'.repeat(64), _internal: 'b'.repeat(64) },
      events: {},
      ...extra,
    }),
  );
  return file;
};

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-cache-path-'));
  configRoot = path.join(tmpDir, 'config');
  fs.mkdirSync(configRoot);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('exportCachePath', () => {
  it('is absent unless configured', () => {
    expect(loadConfig(configWith({})).exportCachePath).toBeUndefined();
  });

  it('is where exports are cached when configured', () => {
    const cacheDir = path.join(tmpDir, 'exports');
    const config = loadConfig(configWith({ exportCachePath: cacheDir }));
    expect(config.exportCachePath).toBe(cacheDir);

    initExportCache(config.exportCachePath);
    cacheExport({
      fsPath: '/docs/a.md',
      key: 'k',
      format: 'docx',
      buffer: Buffer.from('x'),
      printStyle: 'default',
    });

    expect(fs.readdirSync(cacheDir).sort()).toEqual([
      '_export-index.json',
      'k.docx',
    ]);
  });
});
