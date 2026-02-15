/**
 * Tests for cryptographic utilities
 */

import { describe, expect, it } from 'vitest';

import {
  computeInsiderKey,
  computeOutsiderKeyWithExpiry,
  computePathKey,
  timingSafeEqual,
} from './crypto.js';

describe('crypto utilities', () => {
  const testApiKey = 'test-api-key-12345';

  describe('computePathKey', () => {
    it('should compute a 32-character hex key', () => {
      const key = computePathKey(testApiKey, '/foo/bar');
      expect(key).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should normalize paths (case-insensitive)', () => {
      const key1 = computePathKey(testApiKey, '/Foo/Bar');
      const key2 = computePathKey(testApiKey, '/foo/bar');
      expect(key1).toBe(key2);
    });

    it('should normalize paths (trim slashes)', () => {
      const key1 = computePathKey(testApiKey, '/foo/bar/');
      const key2 = computePathKey(testApiKey, 'foo/bar');
      expect(key1).toBe(key2);
    });

    it('should produce different keys for different paths', () => {
      const key1 = computePathKey(testApiKey, '/foo/bar');
      const key2 = computePathKey(testApiKey, '/baz/qux');
      expect(key1).not.toBe(key2);
    });

    it('should produce different keys for different API keys', () => {
      const key1 = computePathKey('api-key-1', '/foo/bar');
      const key2 = computePathKey('api-key-2', '/foo/bar');
      expect(key1).not.toBe(key2);
    });
  });

  describe('computeInsiderKey', () => {
    it('should compute a 32-character hex key', () => {
      const key = computeInsiderKey(testApiKey);
      expect(key).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should be deterministic (same API key = same insider key)', () => {
      const key1 = computeInsiderKey(testApiKey);
      const key2 = computeInsiderKey(testApiKey);
      expect(key1).toBe(key2);
    });

    it('should produce different keys for different API keys', () => {
      const key1 = computeInsiderKey('api-key-1');
      const key2 = computeInsiderKey('api-key-2');
      expect(key1).not.toBe(key2);
    });
  });

  describe('computeOutsiderKeyWithExpiry', () => {
    it('should compute a 32-character hex key', () => {
      const expiry = Date.now() + 3600000;
      const key = computeOutsiderKeyWithExpiry(testApiKey, '/foo/bar', expiry);
      expect(key).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should normalize paths (case-insensitive)', () => {
      const expiry = Date.now() + 3600000;
      const key1 = computeOutsiderKeyWithExpiry(testApiKey, '/Foo/Bar', expiry);
      const key2 = computeOutsiderKeyWithExpiry(testApiKey, '/foo/bar', expiry);
      expect(key1).toBe(key2);
    });

    it('should produce different keys for different expiries', () => {
      const expiry1 = Date.now() + 3600000;
      const expiry2 = Date.now() + 7200000;
      const key1 = computeOutsiderKeyWithExpiry(
        testApiKey,
        '/foo/bar',
        expiry1,
      );
      const key2 = computeOutsiderKeyWithExpiry(
        testApiKey,
        '/foo/bar',
        expiry2,
      );
      expect(key1).not.toBe(key2);
    });

    it('should accept string expiry', () => {
      const expiry = String(Date.now() + 3600000);
      const key = computeOutsiderKeyWithExpiry(testApiKey, '/foo/bar', expiry);
      expect(key).toMatch(/^[a-f0-9]{32}$/);
    });
  });

  describe('timingSafeEqual', () => {
    it('should return true for equal strings', () => {
      const a = 'abc123';
      const b = 'abc123';
      expect(timingSafeEqual(a, b)).toBe(true);
    });

    it('should return false for different strings', () => {
      const a = 'abc123';
      const b = 'def456';
      expect(timingSafeEqual(a, b)).toBe(false);
    });

    it('should return false for strings of different lengths', () => {
      const a = 'abc';
      const b = 'abcdef';
      expect(timingSafeEqual(a, b)).toBe(false);
    });

    it('should return false for empty strings vs non-empty', () => {
      expect(timingSafeEqual('', 'abc')).toBe(false);
      expect(timingSafeEqual('abc', '')).toBe(false);
    });

    it('should return true for empty strings', () => {
      expect(timingSafeEqual('', '')).toBe(true);
    });
  });
});
