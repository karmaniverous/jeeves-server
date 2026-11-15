import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock(import('@karmaniverous/jeeves'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getConfigRoot: () => loadConfigTestConfigRoot,
    SERVER_PORT: 1934 as const,
  };
});

let loadConfigTestConfigRoot = '';

import { clearConfig, getConfig, initConfig, loadConfig } from './index.js';
import { VALID_CONFIG, writeConfig } from './loadConfig.testHelpers.js';

describe('deprecated config property migration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-config-'));
    loadConfigTestConfigRoot = path.join(tmpDir, 'config');
    fs.mkdirSync(loadConfigTestConfigRoot, { recursive: true });
    clearConfig();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    clearConfig();
  });

  it('loads config with deprecated host, watcherUrl, runnerUrl, metaUrl', () => {
    const configWithDeprecated = {
      ...VALID_CONFIG,
      host: '0.0.0.0',
      watcherUrl: 'http://localhost:1936',
      runnerUrl: 'http://localhost:1937',
      metaUrl: 'http://localhost:1938',
    };
    const configPath = writeConfig(tmpDir, configWithDeprecated);
    const config = loadConfig(configPath);
    expect(config.port).toBe(9999);
  });

  it('logs deprecation warnings for each deprecated property', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const configWithDeprecated = {
        ...VALID_CONFIG,
        host: '0.0.0.0',
        watcherUrl: 'http://localhost:1936',
        runnerUrl: 'http://localhost:1937',
        metaUrl: 'http://localhost:1938',
      };
      const configPath = writeConfig(tmpDir, configWithDeprecated);
      loadConfig(configPath);

      const deprecatedKeys = ['host', 'watcherUrl', 'runnerUrl', 'metaUrl'];
      for (const key of deprecatedKeys) {
        expect(
          warnSpy.mock.calls.some(
            (call) =>
              typeof call[0] === 'string' && call[0].includes(`"${key}"`),
          ),
        ).toBe(true);
      }
      expect(warnSpy).toHaveBeenCalledTimes(4);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('strips deprecated properties from the resulting RuntimeConfig', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const configWithDeprecated = {
        ...VALID_CONFIG,
        host: '0.0.0.0',
        watcherUrl: 'http://localhost:1936',
      };
      const configPath = writeConfig(tmpDir, configWithDeprecated);
      const config = loadConfig(configPath);

      const configAsRecord = config as unknown as Record<string, unknown>;
      expect(configAsRecord['host']).toBeUndefined();
      expect(configAsRecord['watcherUrl']).toBeUndefined();
      expect(configAsRecord['runnerUrl']).toBeUndefined();
      expect(configAsRecord['metaUrl']).toBeUndefined();
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('config singleton', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-config-'));
    loadConfigTestConfigRoot = path.join(tmpDir, 'config');
    fs.mkdirSync(loadConfigTestConfigRoot, { recursive: true });
    clearConfig();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    clearConfig();
  });

  it('throws if getConfig called before initConfig', () => {
    expect(() => getConfig()).toThrow('Config not initialized');
  });

  it('initConfig populates getConfig', () => {
    const configPath = writeConfig(tmpDir, VALID_CONFIG);
    initConfig(configPath);
    const config = getConfig();
    expect(config.port).toBe(9999);
  });

  it('clearConfig clears the singleton', () => {
    const configPath = writeConfig(tmpDir, VALID_CONFIG);
    initConfig(configPath);
    clearConfig();
    expect(() => getConfig()).toThrow('Config not initialized');
  });
});
