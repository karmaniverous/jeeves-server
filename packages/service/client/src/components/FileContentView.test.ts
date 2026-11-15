import { describe, expect, it, vi } from 'vitest';

import type { FileContent } from '@/lib/apiTypes';
import { mountComponent } from '@/test/reactHarness';

// The page was opened from a share link.
vi.mock('@/lib/server', () => ({
  pageCredential: { k: 'abc', exp: '9' },
  server: {},
}));

const { FileContentView } = await import('./FileContentView');

/** Props for a file of `type` at `j/a b.bin`. */
const propsFor = (type: FileContent['type']) => {
  const file = { type, fileName: 'a b.bin' } as FileContent;
  return {
    reqPath: 'j/a b.bin',
    file,
    fileRaw: null,
    fileRendered: null,
    viewTab: 'raw' as const,
    editing: false,
    setEditing: vi.fn(),
    proseWidth: 'medium' as const,
    topBarHeight: 0,
    mainRef: { current: null },
    mobileTocOpen: false,
    setMobileTocOpen: vi.fn(),
    onSave: vi.fn(),
    refetch: vi.fn(),
    loading: false,
  };
};

describe('FileContentView raw links in a share-link view', () => {
  it.each([
    ['image', 'img', 'src'],
    ['binary', 'a', 'href'],
  ] as const)(
    'a %s carries the page share credential',
    async (type, tag, attr) => {
      const view = await mountComponent(FileContentView, propsFor(type));
      expect(view.container.querySelector(tag)?.getAttribute(attr)).toBe(
        '/api/raw/j/a b.bin?k=abc&exp=9',
      );
      await view.unmount();
    },
  );
});
