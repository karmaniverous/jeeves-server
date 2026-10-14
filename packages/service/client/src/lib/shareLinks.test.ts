import { describe, expect, it } from 'vitest';

import { deriveShareLink } from './shareLinks';

const ORIGIN = 'https://jeeves.example.com';

describe('deriveShareLink (#279)', () => {
  const share = '/browse/j/docs/a.md?k=abc&exp=9';

  it('returns the absolute page URL', () => {
    expect(deriveShareLink(ORIGIN, share, 'page')).toBe(
      'https://jeeves.example.com/browse/j/docs/a.md?k=abc&exp=9',
    );
  });

  it('maps the page URL onto /api/raw/ and keeps the auth query', () => {
    expect(deriveShareLink(ORIGIN, share, 'raw')).toBe(
      'https://jeeves.example.com/api/raw/j/docs/a.md?k=abc&exp=9',
    );
  });

  it('builds the event URL with k, parsing the query instead of splitting', () => {
    const url = new URL(deriveShareLink(ORIGIN, share, 'event'));
    expect(url.pathname).toBe('/event');
    expect(url.searchParams.get('k')).toBe('abc');
    expect(url.searchParams.has('key')).toBe(false);
  });

  it('only rewrites a leading /browse/ segment', () => {
    expect(deriveShareLink(ORIGIN, '/browse/j/browse/a.md?k=abc', 'raw')).toBe(
      'https://jeeves.example.com/api/raw/j/browse/a.md?k=abc',
    );
  });
});
