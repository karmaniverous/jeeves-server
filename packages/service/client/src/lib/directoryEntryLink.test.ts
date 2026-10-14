import { describe, expect, it } from 'vitest';

import { entryLinkTarget } from './directoryEntryLink';

describe('entryLinkTarget', () => {
  it('routes within the SPA outside deep-share listings', () => {
    expect(entryLinkTarget('r/docs/a.md', undefined)).toEqual({
      kind: 'route',
      to: '/browse/r/docs/a.md',
    });
  });

  it('opens the entry with its own share URL in deep-share listings', () => {
    expect(
      entryLinkTarget('r/docs/a.md', '/browse/r/docs/a.md?k=x&d=1'),
    ).toEqual({
      kind: 'share',
      href: '/browse/r/docs/a.md?k=x&d=1',
    });
  });

  it('renders plain text when the entry may not be opened', () => {
    expect(entryLinkTarget('r/docs/a.md', null)).toEqual({ kind: 'none' });
  });

  describe('under a plain outsider share', () => {
    it('keeps the share key and expiry on route links', () => {
      expect(
        entryLinkTarget('r/docs/a.md', undefined, '?k=abc&exp=1700000000'),
      ).toEqual({
        kind: 'route',
        to: '/browse/r/docs/a.md?k=abc&exp=1700000000',
      });
    });

    it('keeps a share key without expiry', () => {
      expect(entryLinkTarget('r/docs/a.md', undefined, '?k=abc')).toEqual({
        kind: 'route',
        to: '/browse/r/docs/a.md?k=abc',
      });
    });

    it('carries a legacy key as k', () => {
      expect(
        entryLinkTarget('r/docs/a.md', undefined, '?key=abc&exp=9'),
      ).toEqual({ kind: 'route', to: '/browse/r/docs/a.md?k=abc&exp=9' });
    });

    it('drops non-auth params from the current page', () => {
      expect(
        entryLinkTarget('r/docs/a.md', undefined, '?k=abc&tab=raw'),
      ).toEqual({ kind: 'route', to: '/browse/r/docs/a.md?k=abc' });
    });
  });

  describe('without a URL key (insider or session browsing)', () => {
    it('adds no key to route links', () => {
      expect(entryLinkTarget('r/docs/a.md', undefined, '')).toEqual({
        kind: 'route',
        to: '/browse/r/docs/a.md',
      });
    });

    it('ignores non-auth params', () => {
      expect(
        entryLinkTarget('r/docs/a.md', undefined, '?tab=raw&exp=9'),
      ).toEqual({ kind: 'route', to: '/browse/r/docs/a.md' });
    });
  });

  it('keeps the share query across nested navigation (refresh/copy regression)', () => {
    // Open a plain outsider directory share, follow a subdirectory, then a
    // file. Each child URL must still carry the share query on its own, so
    // reloading or copying it stays authorised.
    const shareSearch = '?k=abc&exp=1700000000';
    const child = entryLinkTarget('r/docs/sub', undefined, shareSearch);
    expect(child.kind).toBe('route');
    const childUrl = new URL(
      child.kind === 'route' ? child.to : '',
      'https://host.example',
    );
    expect(childUrl.pathname).toBe('/browse/r/docs/sub');
    expect(childUrl.searchParams.get('k')).toBe('abc');
    expect(childUrl.searchParams.get('exp')).toBe('1700000000');

    // A reload of the child URL starts from its own query string only.
    const grandchild = entryLinkTarget(
      'r/docs/sub/a.md',
      undefined,
      childUrl.search,
    );
    expect(grandchild).toEqual({
      kind: 'route',
      to: '/browse/r/docs/sub/a.md?k=abc&exp=1700000000',
    });
  });
});
