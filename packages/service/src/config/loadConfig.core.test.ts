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

import { clearConfig, loadConfig } from './index.js';
import { VALID_CONFIG, writeConfig } from './loadConfig.testHelpers.js';

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

  it('refuses email login without publicUrl, naming publicUrl', () => {
    const configPath = writeConfig(tmpDir, {
      ...VALID_CONFIG,
      auth: {
        modes: ['keys', 'email'],
        sessionSecret: 's'.repeat(32),
        email: { smtpUrl: 'smtp://localhost:25', fromAddress: 'a@example.com' },
      },
    });
    expect(() => loadConfig(configPath)).toThrow(
      /Invalid configuration[\s\S]*- publicUrl: publicUrl is required when email login is configured/u,
    );
  });

  it('loads email login with trustProxyHeaders: true and no publicUrl', () => {
    const configPath = writeConfig(tmpDir, {
      ...VALID_CONFIG,
      trustProxyHeaders: true,
      auth: {
        modes: ['keys', 'email'],
        sessionSecret: 's'.repeat(32),
        email: { smtpUrl: 'smtp://localhost:25', fromAddress: 'a@example.com' },
      },
    });
    expect(loadConfig(configPath).trustProxyHeaders).toBe(true);
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
