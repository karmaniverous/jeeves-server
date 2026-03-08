import { describe, expect, it } from 'vitest';

import {
  connectionFail,
  deriveKey,
  fail,
  getApiUrl,
  getPluginKey,
  ok,
  type PluginApi,
  withAuth,
} from './helpers.js';

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
    const expected = createHmac('sha256', seed).update('insider').digest('hex').substring(0, 32);
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

describe('getApiUrl', () => {
  it('returns default when no config', () => {
    const api = {} as unknown as PluginApi;
    expect(getApiUrl(api)).toBe('http://127.0.0.1:1934');
  });

  it('returns configured URL', () => {
    const api = {
      config: {
        plugins: {
          entries: {
            'jeeves-server-openclaw': {
              config: { apiUrl: 'http://custom:9999' },
            },
          },
        },
      },
    } as unknown as PluginApi;
    expect(getApiUrl(api)).toBe('http://custom:9999');
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

describe('ok', () => {
  it('wraps data as JSON text content', () => {
    const result = ok({ foo: 'bar' });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(JSON.parse(result.content[0].text)).toEqual({ foo: 'bar' });
    expect(result.isError).toBeUndefined();
  });
});

describe('fail', () => {
  it('wraps error message', () => {
    const result = fail(new Error('boom'));
    expect(result.content[0].text).toBe('Error: boom');
    expect(result.isError).toBe(true);
  });

  it('handles string errors', () => {
    const result = fail('something broke');
    expect(result.content[0].text).toBe('Error: something broke');
  });
});

describe('connectionFail', () => {
  it('provides actionable guidance for ECONNREFUSED', () => {
    const err = new Error('connect failed');
    (err as unknown as Record<string, unknown>).cause = {
      code: 'ECONNREFUSED',
    };
    const result = connectionFail(err, 'http://localhost:1934');
    expect(result.content[0].text).toContain('Server not reachable');
    expect(result.content[0].text).toContain('jeeves-server-openclaw');
    expect(result.isError).toBe(true);
  });

  it('falls back to generic error for other errors', () => {
    const result = connectionFail(new Error('timeout'), 'http://localhost');
    expect(result.content[0].text).toBe('Error: timeout');
    expect(result.isError).toBe(true);
  });
});
