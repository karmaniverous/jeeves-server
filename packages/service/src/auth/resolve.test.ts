import { describe, expect, it } from 'vitest';

import type { NormalizedScopes, RuntimeConfig } from '../config/types.js';
import { computeInsiderKey } from '../util/crypto.js';
import {
  extractDeepParams,
  resolveKeyAuth,
  sanitizeReturnTo,
} from './resolve.js';

describe('extractDeepParams', () => {
  it('returns undefined when d is absent', () => {
    expect(extractDeepParams({ s: 'stack' })).toBeUndefined();
  });

  it('returns undefined when s is absent', () => {
    expect(extractDeepParams({ d: '2' })).toBeUndefined();
  });

  it('returns undefined when both d and s are absent', () => {
    expect(extractDeepParams({})).toBeUndefined();
  });

  it('extracts params when d and s are present', () => {
    expect(extractDeepParams({ d: '2', s: 'abc' })).toEqual({
      d: '2',
      dirs: '0',
      s: 'abc',
    });
  });

  it('passes dirs through when present', () => {
    expect(extractDeepParams({ d: '1', dirs: '1', s: 'xyz' })).toEqual({
      d: '1',
      dirs: '1',
      s: 'xyz',
    });
  });

  it('defaults dirs to 0 when absent', () => {
    const result = extractDeepParams({ d: '3', s: 'stack' });
    expect(result?.dirs).toBe('0');
  });

  it('ignores key and exp fields', () => {
    const result = extractDeepParams({
      key: 'abc',
      exp: '123',
      d: '1',
      s: 's',
    });
    expect(result).toEqual({ d: '1', dirs: '0', s: 's' });
  });
});

describe('sanitizeReturnTo', () => {
  it('allows a simple relative path', () => {
    expect(sanitizeReturnTo('/browse/j/docs')).toBe('/browse/j/docs');
  });

  it('allows root path', () => {
    expect(sanitizeReturnTo('/')).toBe('/');
  });

  it('allows path with query string', () => {
    expect(sanitizeReturnTo('/browse?key=abc')).toBe('/browse?key=abc');
  });

  it('rejects protocol-relative URLs', () => {
    expect(sanitizeReturnTo('//evil.com')).toBe('/browse');
  });

  it('rejects absolute http URLs', () => {
    expect(sanitizeReturnTo('https://evil.com')).toBe('/browse');
  });

  it('rejects javascript: URIs', () => {
    expect(sanitizeReturnTo('javascript:alert(1)')).toBe('/browse');
  });

  it('rejects data: URIs', () => {
    expect(sanitizeReturnTo('data:text/html,<h1>hi</h1>')).toBe('/browse');
  });

  it('rejects bare strings', () => {
    expect(sanitizeReturnTo('evil.com/path')).toBe('/browse');
  });

  it('uses custom fallback when provided', () => {
    expect(sanitizeReturnTo('https://evil.com', '/home')).toBe('/home');
  });
});

describe('resolveKeyAuth', () => {
  const scoped: NormalizedScopes = {
    allow: ['/j/content/**'],
    deny: [],
    explicitAllow: [],
    explicitDeny: [],
  };
  const config = {
    resolvedKeys: [{ name: 'scoped', seed: 'machine-seed', scopes: scoped }],
    resolvedInsiders: [],
  } as unknown as RuntimeConfig;

  it('fails without a key', () => {
    expect(
      resolveKeyAuth(config, '/j/content/a.md', undefined, undefined),
    ).toEqual({ valid: false });
  });

  it('passes the verified key scopes through', () => {
    const result = resolveKeyAuth(
      config,
      '/j/content/a.md',
      computeInsiderKey('machine-seed'),
      undefined,
    );
    expect(result).toMatchObject({
      valid: true,
      mode: 'insider',
      seed: 'machine-seed',
      keyName: 'scoped',
      scopes: scoped,
    });
  });

  it('fails for a key outside its scopes', () => {
    expect(
      resolveKeyAuth(
        config,
        '/j/config/x.json',
        computeInsiderKey('machine-seed'),
        undefined,
      ),
    ).toEqual({ valid: false });
  });
});
