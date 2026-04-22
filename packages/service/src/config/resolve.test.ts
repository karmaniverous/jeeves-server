import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildRuntimeConfig,
  deriveInternalKey,
  normalizeScopes,
  resolveInsiders,
  resolveKeys,
  resolveNamedScopes,
  resolvePlantuml,
} from './resolve.js';
import type { JeevesConfig } from './schema.js';

describe('normalizeScopes', () => {
  it('returns null for undefined', () => {
    expect(normalizeScopes(undefined)).toBe(null);
  });

  it('returns null for null', () => {
    expect(normalizeScopes(null)).toBe(null);
  });

  it('wraps a string in allow array', () => {
    expect(normalizeScopes('/docs')).toEqual({
      allow: ['/docs'],
      deny: [],
      explicitAllow: [],
      explicitDeny: [],
    });
  });

  it('wraps an array as allow', () => {
    expect(normalizeScopes(['/a', '/b'])).toEqual({
      allow: ['/a', '/b'],
      deny: [],
      explicitAllow: [],
      explicitDeny: [],
    });
  });

  it('fills defaults for partial object', () => {
    expect(normalizeScopes({ deny: ['/secret'] })).toEqual({
      allow: ['/**'],
      deny: ['/secret'],
      explicitAllow: [],
      explicitDeny: [],
    });
  });

  it('passes through complete object', () => {
    const scopes = { allow: ['/a'], deny: ['/b'] };
    expect(normalizeScopes(scopes)).toEqual({
      ...scopes,
      explicitAllow: [],
      explicitDeny: [],
    });
  });
});

describe('resolveKeys', () => {
  it('handles string key entries', () => {
    const result = resolveKeys({ primary: 'seed123' }, {});
    expect(result).toEqual([
      { name: 'primary', seed: 'seed123', scopes: null },
    ]);
  });

  it('handles object key entries with scopes', () => {
    const result = resolveKeys(
      {
        scoped: { key: 'seed456', scopes: ['/docs'] },
      },
      {},
    );
    expect(result[0].name).toBe('scoped');
    expect(result[0].seed).toBe('seed456');
    expect(result[0].scopes).toEqual({
      allow: ['/docs'],
      deny: [],
      explicitAllow: [],
      explicitDeny: [],
    });
  });

  it('handles mixed entries', () => {
    const result = resolveKeys(
      {
        plain: 'abc',
        complex: { key: 'def', scopes: { allow: ['/x'], deny: ['/y'] } },
      },
      {},
    );
    expect(result).toHaveLength(2);
    expect(result[0].scopes).toBe(null);
    expect(result[1].scopes).toEqual({
      allow: ['/x'],
      deny: ['/y'],
      explicitAllow: [],
      explicitDeny: [],
    });
  });
});

describe('resolveInsiders', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-resolve-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('normalizes email to lowercase', () => {
    const stateFile = path.join(tmpDir, 'state.json');
    const result = resolveInsiders({ 'Test@Example.COM': {} }, {}, stateFile);
    expect(result[0].email).toBe('test@example.com');
  });

  it('merges state keys when available', () => {
    const stateFile = path.join(tmpDir, 'state.json');
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        insiderKeys: {
          'test@example.com': { seed: 'stateseed', createdAt: '2026-01-01' },
        },
      }),
    );
    const result = resolveInsiders({ 'test@example.com': {} }, {}, stateFile);
    expect(result[0].seed).toBe('stateseed');
    expect(result[0].keyCreatedAt).toBe('2026-01-01');
  });

  it('returns empty seed when no state exists', () => {
    const stateFile = path.join(tmpDir, 'state.json');
    const result = resolveInsiders({ 'new@example.com': {} }, {}, stateFile);
    expect(result[0].seed).toBe('');
    expect(result[0].keyCreatedAt).toBe(null);
  });

  it('prefers config seed over state seed', () => {
    const stateFile = path.join(tmpDir, 'state.json');
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        insiderKeys: {
          'test@example.com': { seed: 'stateseed', createdAt: '2026-01-01' },
        },
      }),
    );
    const result = resolveInsiders(
      {
        'test@example.com': {
          seed: 'configseed',
          keyCreatedAt: '2026-02-01',
        },
      },
      {},
      stateFile,
    );
    expect(result[0].seed).toBe('configseed');
    expect(result[0].keyCreatedAt).toBe('2026-02-01');
  });

  it('falls back to state seed when config seed is absent', () => {
    const stateFile = path.join(tmpDir, 'state.json');
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        insiderKeys: {
          'test@example.com': { seed: 'stateseed', createdAt: '2026-01-01' },
        },
      }),
    );
    const result = resolveInsiders({ 'test@example.com': {} }, {}, stateFile);
    expect(result[0].seed).toBe('stateseed');
    expect(result[0].keyCreatedAt).toBe('2026-01-01');
  });
});

describe('resolveNamedScopes', () => {
  it('resolves a single named scope', () => {
    const named = { restricted: { allow: ['/**'], deny: ['/secret'] } };
    expect(resolveNamedScopes(named, 'restricted')).toEqual({
      allow: ['/**'],
      deny: ['/secret'],
      explicitAllow: [],
      explicitDeny: [],
    });
  });

  it('unions multiple named scopes and merges overrides', () => {
    const named = {
      restricted: { allow: ['/**'], deny: ['/secret'] },
      noVc: { deny: ['/vc/**'] },
    };
    expect(
      resolveNamedScopes(named, ['restricted', 'noVc'], {
        allow: ['/extra'],
        deny: ['/more'],
      }),
    ).toEqual({
      allow: ['/**', '/extra'],
      deny: ['/secret', '/vc/**', '/more'],
      explicitAllow: ['/extra'],
      explicitDeny: ['/more'],
    });
  });

  it('falls back to legacy inline scope strings', () => {
    const named = { restricted: { allow: ['/**'] } };
    expect(resolveNamedScopes(named, '/docs')).toEqual({
      allow: ['/docs'],
      deny: [],
      explicitAllow: [],
      explicitDeny: [],
    });
  });
});

describe('resolvePlantuml', () => {
  it('appends community server as fallback', () => {
    const result = resolvePlantuml();
    expect(result.servers).toContain('https://www.plantuml.com/plantuml');
  });

  it('does not duplicate community server if already listed', () => {
    const result = resolvePlantuml({
      servers: ['https://www.plantuml.com/plantuml'],
    });
    expect(
      result.servers.filter((s) => s === 'https://www.plantuml.com/plantuml'),
    ).toHaveLength(1);
  });

  it('preserves configured servers before community', () => {
    const result = resolvePlantuml({
      servers: ['https://private.example.com'],
    });
    expect(result.servers[0]).toBe('https://private.example.com');
    expect(result.servers[1]).toBe('https://www.plantuml.com/plantuml');
  });

  it('passes through jarPath and javaPath', () => {
    const result = resolvePlantuml({
      jarPath: '/opt/plantuml.jar',
      javaPath: '/usr/bin/java',
    });
    expect(result.jarPath).toBe('/opt/plantuml.jar');
    expect(result.javaPath).toBe('/usr/bin/java');
  });
});

describe('deriveInternalKey', () => {
  it('returns null when no _internal key exists', () => {
    const keys = [{ name: 'primary', seed: 'abc', scopes: null }];
    expect(deriveInternalKey(keys)).toBe(null);
  });

  it('derives a key from _internal seed', () => {
    const keys = [{ name: '_internal', seed: 'x'.repeat(64), scopes: null }];
    const result = deriveInternalKey(keys);
    expect(result).toBeTypeOf('string');
    expect(result!.length).toBeGreaterThan(0);
  });
});

vi.mock('@karmaniverous/jeeves', () => ({
  getConfigRoot: () => buildRuntimeConfigTestConfigRoot,
  SERVER_PORT: 1934,
}));

let buildRuntimeConfigTestConfigRoot = '';

describe('buildRuntimeConfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-brc-'));
    buildRuntimeConfigTestConfigRoot = path.join(tmpDir, 'config');
    fs.mkdirSync(buildRuntimeConfigTestConfigRoot, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('constructs correct path fields', () => {
    const config = {
      port: 1934,
      eventTimeoutMs: 30000,
      eventLogPurgeMs: 2592000000,
      maxZipSizeMb: 100,
      chromePath: '/usr/bin/chrome',
      scopes: {},
      events: {},
      auth: { modes: ['keys' as const] },
      keys: { primary: 'a'.repeat(64) },
      insiders: {},
      go: {},
    } as JeevesConfig;

    const result = buildRuntimeConfig(
      config,
      '/srv/jeeves',
      '/srv/jeeves/config.json',
    );

    const expectedStateDir = path.join(tmpDir, 'state', 'jeeves-server');
    expect(result.stateFile).toBe(path.join(expectedStateDir, 'state.json'));
    expect(fs.existsSync(expectedStateDir)).toBe(true);
    expect(result.eventsLog).toBe(
      path.join('/srv/jeeves', 'logs', 'webhook-events.jsonl'),
    );
    expect(result.configPath).toBe('/srv/jeeves/config.json');
    expect(result.port).toBe(1934);
    expect(result.authModes).toEqual(['keys']);
  });

  it('migrates state.json from old location', () => {
    const config = {
      port: 1934,
      eventTimeoutMs: 30000,
      eventLogPurgeMs: 2592000000,
      maxZipSizeMb: 100,
      chromePath: '/usr/bin/chrome',
      scopes: {},
      events: {},
      auth: { modes: ['keys' as const] },
      keys: { primary: 'a'.repeat(64) },
      insiders: {},
      go: {},
    } as JeevesConfig;

    const oldRootDir = path.join(tmpDir, 'pkg');
    fs.mkdirSync(oldRootDir, { recursive: true });
    const oldState = {
      insiderKeys: { 'a@b.com': { seed: 'old', createdAt: '2026-01-01' } },
    };
    fs.writeFileSync(
      path.join(oldRootDir, 'state.json'),
      JSON.stringify(oldState),
    );

    const result = buildRuntimeConfig(config, oldRootDir, '/cfg.json');

    const newState = JSON.parse(
      fs.readFileSync(result.stateFile, 'utf8'),
    ) as unknown;
    expect(newState).toEqual(oldState);
  });
});
