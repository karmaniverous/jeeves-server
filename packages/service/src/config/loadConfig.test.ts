import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@karmaniverous/jeeves', () => ({
  getConfigRoot: () => loadConfigTestConfigRoot,
  SERVER_PORT: 1934,
}));

let loadConfigTestConfigRoot = '';

import { clearConfig, getConfig, initConfig, loadConfig } from './index.js';

const VALID_CONFIG = {
  port: 9999,
  chromePath: '/usr/bin/chromium',
  auth: { modes: ['keys'] },
  keys: {
    primary: 'a'.repeat(64),
    _internal: 'b'.repeat(64),
  },
  events: {},
};

function writeConfig(dir: string, config: unknown): string {
  const filePath = path.join(dir, 'jeeves-server.config.json');
  fs.writeFileSync(filePath, JSON.stringify(config));
  return filePath;
}

describe('loadConfig', () => {
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

  it('loads a valid JSON config file', () => {
    const configPath = writeConfig(tmpDir, VALID_CONFIG);
    const config = loadConfig(configPath);
    expect(config.port).toBe(9999);
    expect(config.chromePath).toBe('/usr/bin/chromium');
    // Migration moves jeeves-server.config.json → jeeves-server/config.json
    const expectedPath = path.join(tmpDir, 'jeeves-server', 'config.json');
    expect(config.configPath).toBe(expectedPath);
  });

  it('throws on missing config', () => {
    expect(() => loadConfig(path.join(tmpDir, 'nonexistent.json'))).toThrow();
  });

  it('throws on invalid config (missing auth)', () => {
    const configPath = writeConfig(tmpDir, { port: 1234 });
    expect(() => loadConfig(configPath)).toThrow('Invalid configuration');
  });

  it('applies env var substitution', () => {
    const original = process.env['TEST_CHROME_PATH'];
    process.env['TEST_CHROME_PATH'] = '/custom/chrome';
    try {
      const configPath = writeConfig(tmpDir, {
        ...VALID_CONFIG,
        chromePath: '${TEST_CHROME_PATH}',
      });
      const config = loadConfig(configPath);
      expect(config.chromePath).toBe('/custom/chrome');
    } finally {
      if (original === undefined) delete process.env['TEST_CHROME_PATH'];
      else process.env['TEST_CHROME_PATH'] = original;
    }
  });

  it('applies default port when omitted', () => {
    const noPort = { ...VALID_CONFIG };
    delete (noPort as Record<string, unknown>).port;
    const configPath = writeConfig(tmpDir, noPort);
    const config = loadConfig(configPath);
    expect(config.port).toBe(1934);
  });

  it('rejects _plugin key with scopes', () => {
    const configPath = writeConfig(tmpDir, {
      ...VALID_CONFIG,
      keys: {
        ...VALID_CONFIG.keys,
        _plugin: { key: 'c'.repeat(64), scopes: ['/restricted'] },
      },
    });
    expect(() => loadConfig(configPath)).toThrow(
      '_plugin key must not have scopes',
    );
  });

  it('rejects _internal key with scopes', () => {
    const configPath = writeConfig(tmpDir, {
      ...VALID_CONFIG,
      keys: {
        ...VALID_CONFIG.keys,
        _internal: { key: 'b'.repeat(64), scopes: ['/restricted'] },
      },
    });
    expect(() => loadConfig(configPath)).toThrow(
      '_internal key must not have scopes',
    );
  });

  it('accepts _plugin key without scopes', () => {
    const configPath = writeConfig(tmpDir, {
      ...VALID_CONFIG,
      keys: {
        ...VALID_CONFIG.keys,
        _plugin: 'c'.repeat(64),
      },
    });
    const config = loadConfig(configPath);
    expect(config.resolvedKeys.find((k) => k.name === '_plugin')?.seed).toBe(
      'c'.repeat(64),
    );
  });

  it('rejects undefined named scope references', () => {
    const configPath = writeConfig(tmpDir, {
      ...VALID_CONFIG,
      scopes: { restricted: { allow: ['/**'], deny: ['/secret'] } },
      insiders: {
        'a@example.com': { scopes: 'restricted' },
        'b@example.com': { scopes: 'missing' },
      },
    });

    expect(() => loadConfig(configPath)).toThrow(
      'Scope "missing" is not defined',
    );
  });

  it('does not treat path globs as named scope references', () => {
    const configPath = writeConfig(tmpDir, {
      ...VALID_CONFIG,
      insiders: {
        'a@example.com': { scopes: ['/docs/**'] },
      },
    });

    const config = loadConfig(configPath);
    expect(
      config.resolvedInsiders.find((i) => i.email === 'a@example.com')?.scopes,
    ).toEqual({
      allow: ['/docs/**'],
      deny: [],
      explicitAllow: [],
      explicitDeny: [],
    });
  });
});

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
