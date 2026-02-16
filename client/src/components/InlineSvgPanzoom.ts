/**
 * Post-processes a rendered markdown article to add Panzoom to embedded SVG images.
 * 
 * Finds <img> elements with .svg sources, fetches the SVG content,
 * and replaces them with interactive Panzoom containers.
 */
import Panzoom from '@panzoom/panzoom';

import { withKey } from '@/lib/api';

export function initInlineSvgPanzoom(article: HTMLElement): () => void {
  const cleanups: (() => void)[] = [];
  // Match SVG images — src may end with .svg, .svg?raw=1, .svg&raw=1, etc.
  const imgs = Array.from(article.querySelectorAll<HTMLImageElement>('img')).filter(
    (img) => /\.svg(\?|&|$)/i.test(img.getAttribute('src') ?? '')
  );

  for (const img of imgs) {
    const src = img.getAttribute('src');
    if (!src) continue;

    // Build the raw URL (ensure it fetches the actual SVG content)
    const rawSrc = src.includes('raw=1') ? src : (src.includes('?') ? `${src}&raw=1` : `${src}?raw=1`);

    // Create wrapper structure
    const wrapper = document.createElement('div');
    wrapper.className = 'inline-svg-panzoom relative bg-white rounded-lg border border-border overflow-hidden my-4';
    wrapper.style.cursor = 'grab';

    const container = document.createElement('div');
    container.className = 'overflow-hidden w-full min-h-[200px]';

    const inner = document.createElement('div');
    inner.className = 'flex items-center justify-center p-4 [&>svg]:max-w-full [&>svg]:h-auto';
    inner.textContent = 'Loading SVG…';

    container.appendChild(inner);
    wrapper.appendChild(container);

    // Replace the img with the wrapper
    img.parentElement?.replaceChild(wrapper, img);

    // Fetch SVG content and init Panzoom
    fetch(withKey(rawSrc))
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch SVG: ${String(r.status)}`);
        return r.text();
      })
      .then((svgContent) => {
        inner.innerHTML = svgContent;

        const pz = Panzoom(inner, {
          maxScale: 20,
          contain: 'outside',
        });

        const wheelHandler = (e: WheelEvent) => {
          pz.zoomWithWheel(e);
        };
        container.addEventListener('wheel', wheelHandler, { passive: false });

        // Add hint text
        const hint = document.createElement('div');
        hint.className = 'text-xs text-muted-foreground text-center py-1 opacity-60';
        hint.textContent = 'Scroll to zoom · Drag to pan';
        wrapper.appendChild(hint);

        cleanups.push(() => {
          container.removeEventListener('wheel', wheelHandler);
          pz.destroy();
        });
      })
      .catch(() => {
        // Fallback: put the img back
        inner.innerHTML = '';
        inner.appendChild(img);
      });
  }

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
