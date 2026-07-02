import { describe, expect, it, vi } from 'vitest';

import {
  decryptToken,
  encryptToken,
  formatOtp,
  generateOtp,
  OTP_ALPHABET,
  signToken,
  verifyToken,
} from './magicToken.js';

describe('signToken / verifyToken', () => {
  const secret = 'test-session-secret-256-bit-key!!';

  it('round-trips a token: sign then verify returns the original payload', () => {
    const token = signToken({ email: 'user@example.com' }, secret);
    const payload = verifyToken(token, secret);

    expect(payload).not.toBeNull();
    expect(payload!.email).toBe('user@example.com');
    expect(payload!.exp).toBeGreaterThan(Date.now());
  });

  it('preserves optional returnTo field', () => {
    const token = signToken(
      { email: 'user@example.com', returnTo: '/browse/j/docs' },
      secret,
    );
    const payload = verifyToken(token, secret);

    expect(payload!.returnTo).toBe('/browse/j/docs');
  });

  it('rejects a token signed with a different secret', () => {
    const token = signToken({ email: 'user@example.com' }, secret);
    const payload = verifyToken(token, 'wrong-secret-that-is-different');

    expect(payload).toBeNull();
  });

  it('rejects a token with tampered payload', () => {
    const token = signToken({ email: 'user@example.com' }, secret);
    const [, sig] = token.split('.');
    // Replace payload with a different one
    const tamperedPayload = Buffer.from(
      JSON.stringify({ email: 'attacker@evil.com', exp: Date.now() + 999999 }),
    ).toString('base64url');

    expect(verifyToken(`${tamperedPayload}.${sig}`, secret)).toBeNull();
  });

  it('rejects a token with tampered signature', () => {
    const token = signToken({ email: 'user@example.com' }, secret);
    const [payload] = token.split('.');
    const tamperedSig = Buffer.from('bad-signature-data').toString('base64url');

    expect(verifyToken(`${payload}.${tamperedSig}`, secret)).toBeNull();
  });

  it('rejects an expired token', () => {
    // Sign a token, then fake the clock forward past TTL
    const token = signToken({ email: 'user@example.com' }, secret);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 11 * 60 * 1000); // 11 minutes ahead

    expect(verifyToken(token, secret)).toBeNull();
    vi.useRealTimers();
  });

  it('rejects malformed tokens', () => {
    expect(verifyToken('', secret)).toBeNull();
    expect(verifyToken('no-dot-separator', secret)).toBeNull();
    expect(verifyToken('not-json.valid-sig', secret)).toBeNull();
  });

  it('rejects token with missing email field', async () => {
    // Manually construct a signed token with no email
    const payload = Buffer.from(
      JSON.stringify({ exp: Date.now() + 600000 }),
    ).toString('base64url');
    // Sign it properly but the payload is missing email
    const { createHmac } = await import('node:crypto');
    const sig = createHmac('sha256', secret)
      .update(payload)
      .digest()
      .toString('base64url');

    expect(verifyToken(`${payload}.${sig}`, secret)).toBeNull();
  });
});

describe('generateOtp', () => {
  it('returns an 8-character string', () => {
    const otp = generateOtp();
    expect(otp).toHaveLength(8);
  });

  it('contains only characters from the OTP alphabet', () => {
    // Generate many OTPs to exercise the full alphabet
    for (let i = 0; i < 100; i++) {
      const otp = generateOtp();
      for (const ch of otp) {
        expect(OTP_ALPHABET).toContain(ch);
      }
    }
  });

  it('excludes ambiguous characters (0, 1, o, l)', () => {
    for (let i = 0; i < 100; i++) {
      const otp = generateOtp();
      expect(otp).not.toMatch(/[01ol]/);
    }
  });

  it('generates distinct values (not deterministic)', () => {
    const otps = new Set(Array.from({ length: 50 }, () => generateOtp()));
    // With 32^8 possible values, collisions in 50 draws are astronomically unlikely
    expect(otps.size).toBeGreaterThan(45);
  });
});

describe('formatOtp', () => {
  it('formats 8-char OTP as two groups of four separated by space', () => {
    expect(formatOtp('a3k7m9p2')).toBe('a3k7 m9p2');
  });

  it('handles the boundary correctly', () => {
    expect(formatOtp('abcdefgh')).toBe('abcd efgh');
  });
});

describe('encryptToken / decryptToken', () => {
  const otp = 'a3k7m9p2';
  const tokenPayload =
    'eyJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJleHAiOjk5OTk5OTk5OX0.test-sig';

  it('round-trips: encrypt then decrypt returns original token', () => {
    const encrypted = encryptToken(tokenPayload, otp);
    const decrypted = decryptToken(encrypted, otp);

    expect(decrypted).toBe(tokenPayload);
  });

  it('produces different ciphertext on each call (random IV)', () => {
    const a = encryptToken(tokenPayload, otp);
    const b = encryptToken(tokenPayload, otp);

    expect(a).not.toBe(b);
  });

  it('returns null when decrypting with the wrong OTP', () => {
    const encrypted = encryptToken(tokenPayload, otp);
    expect(decryptToken(encrypted, 'wrongotp')).toBeNull();
  });

  it('returns null for a corrupted blob', () => {
    const encrypted = encryptToken(tokenPayload, otp);
    // Flip some bytes in the middle
    const corrupted = encrypted.slice(0, 10) + 'XXXX' + encrypted.slice(14);
    expect(decryptToken(corrupted, otp)).toBeNull();
  });

  it('returns null for an empty or too-short blob', () => {
    expect(decryptToken('', otp)).toBeNull();
    expect(decryptToken('short', otp)).toBeNull();
  });

  it('produces base64url output (no +, /, or = padding)', () => {
    const encrypted = encryptToken(tokenPayload, otp);
    expect(encrypted).not.toMatch(/[+/=]/);
  });
});
