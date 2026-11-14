import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as AtomicWrite from './atomicWrite.js';

const state = vi.hoisted(() => ({ configPath: '', failWrite: false }));

vi.mock('../config/index.js', () => ({
  getConfig: () => ({ configPath: state.configPath }),
}));

vi.mock('./atomicWrite.js', async (importOriginal) => {
  const actual = await importOriginal<typeof AtomicWrite>();
  return {
    writeFileAtomic: (file: string, content: string) => {
      if (state.failWrite) throw new Error('disk full');
      actual.writeFileAtomic(file, content);
    },
  };
});

const { writeInsiderSeedToConfig } = await import('./configPersist.js');

let dir: string;

/** Write the config file. */
function writeConfig(config: unknown): void {
  fs.writeFileSync(state.configPath, JSON.stringify(config, null, 2));
}

/** Read the config file back. */
function readConfig(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(state.configPath, 'utf8')) as Record<
    string,
    unknown
  >;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-persist-'));
  state.configPath = path.join(dir, 'jeeves-server.config.json');
  state.failWrite = false;
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('writeInsiderSeedToConfig', () => {
  it('sets seed and keyCreatedAt on the insider matched case-insensitively, keeping everything else', async () => {
    writeConfig({
      port: 1934,
      insiders: {
        'Ann@Example.com': { scopes: ['/j'], seed: 'old' },
        'bob@example.com': {},
      },
    });
    await writeInsiderSeedToConfig('ann@EXAMPLE.com', 'new-seed', '2026-11-14');
    expect(readConfig()).toEqual({
      port: 1934,
      insiders: {
        'Ann@Example.com': {
          scopes: ['/j'],
          seed: 'new-seed',
          keyCreatedAt: '2026-11-14',
        },
        'bob@example.com': {},
      },
    });
  });

  it('leaves the file byte-identical for an insider not in the config, or no insiders', async () => {
    for (const config of [
      { insiders: { 'bob@example.com': {} } },
      { port: 1934 },
    ]) {
      writeConfig(config);
      const before = fs.readFileSync(state.configPath, 'utf8');
      await writeInsiderSeedToConfig('ann@example.com', 's', 't');
      expect(fs.readFileSync(state.configPath, 'utf8')).toBe(before);
    }
  });

  it('holds the file lock while updating: a racing update fails fast instead of overwriting', async () => {
    writeConfig({ insiders: { 'a@x.test': {}, 'b@x.test': {} } });
    const [first, second] = await Promise.allSettled([
      writeInsiderSeedToConfig('a@x.test', 'sa', 'ta'),
      writeInsiderSeedToConfig('b@x.test', 'sb', 'tb'),
    ]);
    expect(first.status).toBe('fulfilled');
    expect(second).toMatchObject({
      status: 'rejected',
      reason: { code: 'ELOCKED' },
    });
    expect(readConfig().insiders).toEqual({
      'a@x.test': { seed: 'sa', keyCreatedAt: 'ta' },
      'b@x.test': {},
    });
    // The lock is released afterwards: the next update succeeds.
    await writeInsiderSeedToConfig('b@x.test', 'sb', 'tb');
    expect(readConfig().insiders).toMatchObject({
      'b@x.test': { seed: 'sb', keyCreatedAt: 'tb' },
    });
  });

  it('warns and writes nothing when the config cannot be read as JSON', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    fs.writeFileSync(state.configPath, '{ not json');
    await writeInsiderSeedToConfig('a@x.test', 's', 't');
    expect(fs.readFileSync(state.configPath, 'utf8')).toBe('{ not json');
    expect(warn).toHaveBeenCalledWith(
      'Failed to read config for insider seed update:',
      expect.any(SyntaxError),
    );
  });

  it('warns, without throwing, when the write fails; the file is unchanged', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    writeConfig({ insiders: { 'a@x.test': {} } });
    const before = fs.readFileSync(state.configPath, 'utf8');
    state.failWrite = true;
    await expect(
      writeInsiderSeedToConfig('a@x.test', 's', 't'),
    ).resolves.toBeUndefined();
    expect(fs.readFileSync(state.configPath, 'utf8')).toBe(before);
    expect(warn).toHaveBeenCalledWith(
      'Failed to write config for insider seed update:',
      expect.objectContaining({ message: 'disk full' }),
    );
  });
});
