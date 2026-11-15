import { describe, expect, it, vi } from 'vitest';

import { createElement, mountComponent } from '@/test/reactHarness';

import { BrandingContext, DEFAULT_BRANDING } from './BrandingContext';
import { BrandingProvider } from './BrandingProvider';
import { formatDocumentTitle, useDocumentTitle } from './documentTitle';

vi.mock('./server', () => ({
  client: {
    status: () => Promise.resolve({ health: { branding: { name: 'Acme' } } }),
  },
}));

describe('formatDocumentTitle', () => {
  it('joins a title and the brand', () => {
    expect(formatDocumentTitle('Brief', 'Acme')).toBe('Brief - Acme');
  });

  it.each([null, undefined, ''])('is just the brand for %j', (title) => {
    expect(formatDocumentTitle(title, 'Acme')).toBe('Acme');
  });
});

describe('useDocumentTitle', () => {
  interface PageProps {
    title: string | null;
    brand: string;
  }
  function Page({ title, brand }: PageProps) {
    return createElement(
      BrandingContext.Provider,
      { value: { ...DEFAULT_BRANDING, name: brand } },
      createElement(Probe, { title }),
    );
  }
  function Probe({ title }: { title: string | null }): null {
    useDocumentTitle(title);
    return null;
  }

  it('sets the title, again when the brand loads or the title changes', async () => {
    const page = await mountComponent<PageProps>(Page, {
      title: 'Brief',
      brand: 'X',
    });
    expect(document.title).toBe('Brief - X');
    await page.rerender({ title: 'Brief', brand: 'Acme' });
    expect(document.title).toBe('Brief - Acme');
    await page.rerender({ title: null, brand: 'Acme' });
    expect(document.title).toBe('Acme');
    await page.unmount();
  });

  it('is not overwritten when BrandingProvider loads the brand', async () => {
    function App({ title }: { title: string }) {
      return createElement(BrandingProvider, {
        children: createElement(Probe, { title }),
      });
    }
    const app = await mountComponent(App, { title: 'Brief' });
    expect(document.title).toBe('Brief - Acme');
    await app.unmount();
  });
});
