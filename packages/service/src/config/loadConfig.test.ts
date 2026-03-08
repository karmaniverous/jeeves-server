import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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
    clearConfig();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    clearConfig();
  });

  it('loads a valid JSON config file', async () => {
    const configPath = writeConfig(tmpDir, VALID_CONFIG);
    const config = await loadConfig(configPath);
    expect(config.port).toBe(9999);
    expect(config.chromePath).toBe('/usr/bin/chromium');
    expect(config.configPath).toBe(configPath);
  });

  it('throws on missing config', async () => {
    await expect(
      loadConfig(path.join(tmpDir, 'nonexistent.json')),
    ).rejects.toThrow();
  });

  it('throws on invalid config (missing auth)', async () => {
    const configPath = writeConfig(tmpDir, { port: 1234 });
    await expect(loadConfig(configPath)).rejects.toThrow(
      'Invalid configuration',
    );
  });

  it('applies env var substitution', async () => {
    const original = process.env['TEST_CHROME_PATH'];
    process.env['TEST_CHROME_PATH'] = '/custom/chrome';
    try {
      const configPath = writeConfig(tmpDir, {
        ...VALID_CONFIG,
        chromePath: '${TEST_CHROME_PATH}',
      });
      const config = await loadConfig(configPath);
      expect(config.chromePath).toBe('/custom/chrome');
    } finally {
      if (original === undefined) delete process.env['TEST_CHROME_PATH'];
      else process.env['TEST_CHROME_PATH'] = original;
    }
  });

  it('applies default port when omitted', async () => {
    const noPort = { ...VALID_CONFIG };
    delete (noPort as Record<string, unknown>).port;
    const configPath = writeConfig(tmpDir, noPort);
    const config = await loadConfig(configPath);
    expect(config.port).toBe(1934);
  });

  it('rejects _plugin key with scopes', async () => {
    const configPath = writeConfig(tmpDir, {
      ...VALID_CONFIG,
      keys: {
        ...VALID_CONFIG.keys,
        _plugin: { key: 'c'.repeat(64), scopes: ['/restricted'] },
      },
    });
    await expect(loadConfig(configPath)).rejects.toThrow(
      '_plugin key must not have scopes',
    );
  });

  it('rejects _internal key with scopes', async () => {
    const configPath = writeConfig(tmpDir, {
      ...VALID_CONFIG,
      keys: {
        ...VALID_CONFIG.keys,
        _internal: { key: 'b'.repeat(64), scopes: ['/restricted'] },
      },
    });
    await expect(loadConfig(configPath)).rejects.toThrow(
      '_internal key must not have scopes',
    );
  });

  it('accepts _plugin key without scopes', async () => {
    const configPath = writeConfig(tmpDir, {
      ...VALID_CONFIG,
      keys: {
        ...VALID_CONFIG.keys,
        _plugin: 'c'.repeat(64),
      },
    });
    const config = await loadConfig(configPath);
    expect(config.resolvedKeys.find((k) => k.name === '_plugin')?.seed).toBe(
      'c'.repeat(64),
    );
  });

  it('rejects undefined named scope references', async () => {
    const configPath = writeConfig(tmpDir, {
      ...VALID_CONFIG,
      scopes: { restricted: { allow: ['/**'], deny: ['/secret'] } },
      insiders: {
        'a@example.com': { scopes: 'restricted' },
        'b@example.com': { scopes: 'missing' },
      },
    });

    await expect(loadConfig(configPath)).rejects.toThrow(
      'Scope "missing" is not defined',
    );
  });

  it('does not treat path globs as named scope references', async () => {
    const configPath = writeConfig(tmpDir, {
      ...VALID_CONFIG,
      insiders: {
        'a@example.com': { scopes: ['/docs/**'] },
      },
    });

    const config = await loadConfig(configPath);
    expect(
      config.resolvedInsiders.find((i) => i.email === 'a@example.com')?.scopes,
    ).toEqual({ allow: ['/docs/**'], deny: [] });
  });
});

describe('config singleton', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-config-'));
    clearConfig();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    clearConfig();
  });

  it('throws if getConfig called before initConfig', () => {
    expect(() => getConfig()).toThrow('Config not initialized');
  });

  it('initConfig populates getConfig', async () => {
    const configPath = writeConfig(tmpDir, VALID_CONFIG);
    await initConfig(configPath);
    const config = getConfig();
    expect(config.port).toBe(9999);
  });

  it('clearConfig clears the singleton', async () => {
    const configPath = writeConfig(tmpDir, VALID_CONFIG);
    await initConfig(configPath);
    clearConfig();
    expect(() => getConfig()).toThrow('Config not initialized');
  });
});
