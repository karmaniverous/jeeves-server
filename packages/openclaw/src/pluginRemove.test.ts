/**
 * Tests for shared plugin removal logic.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { removePlugin } from './pluginRemove.js';

describe('removePlugin', () => {
  let tempDir: string;
  let home: string;
  let configPath: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), 'plugin-remove-test-' + String(Date.now()));
    home = join(tempDir, '.openclaw');
    configPath = join(home, 'openclaw.json');
    mkdirSync(join(home, 'extensions', 'jeeves-server-openclaw'), {
      recursive: true,
    });
    writeFileSync(
      join(home, 'extensions', 'jeeves-server-openclaw', 'dummy'),
      'x',
    );
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('removes the extension directory', () => {
    const extDir = join(home, 'extensions', 'jeeves-server-openclaw');
    expect(existsSync(extDir)).toBe(true);

    removePlugin(home, configPath);

    expect(existsSync(extDir)).toBe(false);
  });

  it('patches config to remove plugin entry', () => {
    const config = {
      plugins: {
        entries: { 'jeeves-server-openclaw': { enabled: true } },
      },
    };
    writeFileSync(configPath, JSON.stringify(config));

    const messages = removePlugin(home, configPath);

    const updated = JSON.parse(readFileSync(configPath, 'utf8')) as {
      plugins: { entries: Record<string, unknown> };
    };
    expect(updated.plugins.entries['jeeves-server-openclaw']).toBeUndefined();
    expect(messages.some((m: string) => m.includes('plugins.entries'))).toBe(
      true,
    );
  });

  it('returns removal messages', () => {
    writeFileSync(
      configPath,
      JSON.stringify({
        plugins: {
          entries: { 'jeeves-server-openclaw': { enabled: true } },
        },
      }),
    );

    const messages = removePlugin(home, configPath);

    expect(messages.length).toBeGreaterThanOrEqual(2);
  });

  it('handles missing extension directory gracefully', () => {
    rmSync(join(home, 'extensions', 'jeeves-server-openclaw'), {
      recursive: true,
      force: true,
    });

    const messages = removePlugin(home, configPath);

    // Should not throw, may return empty or config-only messages
    expect(Array.isArray(messages)).toBe(true);
  });

  it('handles missing config file gracefully', () => {
    const messages = removePlugin(home, join(home, 'nonexistent.json'));

    expect(messages.length).toBe(1); // Only ext dir removal
  });
});
