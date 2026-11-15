/**
 * RFC 6266 attachment headers: the ASCII `filename` fallback and the
 * RFC 5987 `filename*` (#316).
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import {
  asciiFileName,
  attachmentDisposition,
  encodeRfc5987,
} from './contentDisposition.js';

describe('asciiFileName', () => {
  it('keeps printable ASCII', () => {
    expect(asciiFileName("a b-(1)'x'.pdf")).toBe("a b-(1)'x'.pdf");
  });

  it('replaces non-ASCII, control characters, quotes and backslashes', () => {
    expect(asciiFileName('ü"\\\t\u{1F600}.txt')).toBe('_____.txt');
  });
});

describe('encodeRfc5987', () => {
  it("percent-encodes UTF-8 and ' ( ) *", () => {
    expect(encodeRfc5987("é (1)'*.pdf")).toBe('%C3%A9%20%281%29%27%2A.pdf');
  });

  it('keeps unreserved characters and encodes the rest (stricter than attr-char, still valid)', () => {
    expect(encodeRfc5987('a-b_c.d~!$&+^`|')).toBe(
      'a-b_c.d~!%24%26%2B%5E%60%7C',
    );
  });
});

describe('attachmentDisposition', () => {
  it('carries both file names', () => {
    expect(attachmentDisposition('Bericht ü.pdf')).toBe(
      `attachment; filename="Bericht _.pdf"; filename*=UTF-8''Bericht%20%C3%BC.pdf`,
    );
  });
});
