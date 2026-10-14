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
});
