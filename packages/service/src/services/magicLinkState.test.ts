import { afterEach, describe, expect, it } from 'vitest';

import {
  clearAllMagicTokens,
  consumeMagicToken,
  storeMagicToken,
} from './magicLinkState.js';

describe('magicLinkState', () => {
  afterEach(() => {
    clearAllMagicTokens();
  });

  it('stores and consumes a token', () => {
    storeMagicToken('abc123', { email: 'test@example.com' });
    const result = consumeMagicToken('abc123');
    expect(result).toEqual({ email: 'test@example.com' });
  });

  it('returns null for unknown tokens', () => {
    const result = consumeMagicToken('nonexistent');
    expect(result).toBeNull();
  });

  it('consumes a token only once (single-use)', () => {
    storeMagicToken('single-use', { email: 'user@example.com' });
    const first = consumeMagicToken('single-use');
    expect(first).not.toBeNull();
    const second = consumeMagicToken('single-use');
    expect(second).toBeNull();
  });

  it('overwrites an existing token', () => {
    storeMagicToken('overwrite', { email: 'first@example.com' });
    storeMagicToken('overwrite', { email: 'second@example.com' });
    const result = consumeMagicToken('overwrite');
    expect(result).toEqual({ email: 'second@example.com' });
  });

  it('clearAllMagicTokens removes all entries', () => {
    storeMagicToken('a', { email: 'a@example.com' });
    storeMagicToken('b', { email: 'b@example.com' });
    clearAllMagicTokens();
    expect(consumeMagicToken('a')).toBeNull();
    expect(consumeMagicToken('b')).toBeNull();
  });
});
