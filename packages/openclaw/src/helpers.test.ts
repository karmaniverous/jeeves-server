import type { PluginApi } from '@karmaniverous/jeeves';
import { describe, expect, it } from 'vitest';

import { deriveKey, getPluginKey, withAuth } from './helpers.js';

describe('deriveKey', () => {
  it('produces a hex string', () => {
    const key = deriveKey('test-seed');
    expect(key).toMatch(/^[0-9a-f]{32}$/);
  });

  it('is deterministic', () => {
    expect(deriveKey('seed-a')).toBe(deriveKey('seed-a'));
  });

  it('varies with seed', () => {
    expect(deriveKey('seed-a')).not.toBe(deriveKey('seed-b'));
  });

  it('matches computeInsiderKey derivation (HMAC sha256 with "insider")', async () => {
    // This is the critical interop test: plugin must derive the same key
    // as the server's computeInsiderKey(seed) function.
    const seed = 'test-seed-12345';
    // Manually compute what computeInsiderKey produces
    const { createHmac } = await import('node:crypto');
    const expected = createHmac('sha256', seed)
      .update('insider')
      .digest('hex')
      .substring(0, 32);
    expect(deriveKey(seed)).toBe(expected);
  });
});

describe('withAuth', () => {
  it('appends key param to URL without query', () => {
    const url = withAuth('http://localhost/api', 'seed');
    expect(url).toContain('?key=');
  });

  it('appends key param to URL with existing query', () => {
    const url = withAuth('http://localhost/api?foo=bar', 'seed');
    expect(url).toContain('&key=');
  });

  it('returns URL unchanged when no seed', () => {
    expect(withAuth('http://localhost/api', undefined)).toBe(
      'http://localhost/api',
    );
  });
});

describe('getPluginKey', () => {
  it('returns undefined when no config', () => {
    expect(getPluginKey({} as PluginApi)).toBeUndefined();
  });

  it('returns configured key', () => {
    const api = {
      config: {
        plugins: {
          entries: {
            'jeeves-server-openclaw': {
              config: { pluginKey: 'my-seed' },
            },
          },
        },
      },
    } as unknown as PluginApi;
    expect(getPluginKey(api)).toBe('my-seed');
  });
});
