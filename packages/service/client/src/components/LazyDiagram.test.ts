import { afterEach, describe, expect, it, vi } from 'vitest';

import { initLazyDiagrams } from './LazyDiagram';

/** An article holding one lazy diagram placeholder. */
function article(): HTMLElement {
  const el = document.createElement('article');
  el.innerHTML =
    '<div class="embedded-diagram-lazy" data-diagram-type="mermaid" data-diagram-hash="abc"></div>';
  return el;
}

/** Let the placeholder's fetch settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('initLazyDiagrams', () => {
  it("shows a failed render's message from the standard error body", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            statusCode: 502,
            code: 'SERVER_EXPORT_FAILED',
            error: 'Bad Gateway',
            message: 'Renderer returned <empty> result',
          }),
          { status: 502 },
        ),
      ),
    );
    const el = article();
    initLazyDiagrams(el);
    await settle();
    expect(el.querySelector('.diagram-error-label')?.textContent).toBe(
      'Mermaid render failed: Renderer returned <empty> result',
    );
  });

  it('fetches the SVG through the diagram entry and shows it', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      );
    vi.stubGlobal('fetch', fetch);
    const el = article();
    initLazyDiagrams(el);
    await settle();
    const [input] = fetch.mock.calls[0] as [string | URL | Request];
    const url = new URL(input instanceof Request ? input.url : String(input));
    expect(url.pathname).toBe('/api/diagram/mermaid/abc.svg');
    expect(el.querySelector('.embedded-diagram-error')).toBeNull();
    expect(el.querySelector('svg')).not.toBeNull();
  });

  it('shows a fixed text when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('down')));
    const el = article();
    initLazyDiagrams(el);
    await settle();
    expect(el.querySelector('.diagram-error-label')?.textContent).toBe(
      'Mermaid render failed: The server could not be reached.',
    );
  });

  it('rejects an unknown diagram type without a request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const el = document.createElement('article');
    el.innerHTML =
      '<div class="embedded-diagram-lazy" data-diagram-type="dot" data-diagram-hash="abc"></div>';
    initLazyDiagrams(el);
    await settle();
    expect(fetch).not.toHaveBeenCalled();
    expect(el.querySelector('.diagram-error-label')?.textContent).toBe(
      'Dot render failed: Unknown diagram type: dot',
    );
  });
});
