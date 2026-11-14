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

  it('falls back to the HTTP status without a message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 500 })),
    );
    const el = article();
    initLazyDiagrams(el);
    await settle();
    expect(el.querySelector('.diagram-error-label')?.textContent).toBe(
      'Mermaid render failed: HTTP 500',
    );
  });

  it('says the render failed when the body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('oops', { status: 500 })),
    );
    const el = article();
    initLazyDiagrams(el);
    await settle();
    expect(el.querySelector('.diagram-error-label')?.textContent).toBe(
      'Mermaid render failed: Render failed',
    );
  });
});
