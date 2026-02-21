/**
 * Post-processes a rendered markdown article to add Panzoom to embedded SVG images.
 *
 * Finds <img> elements with .svg sources, fetches the SVG content,
 * and replaces them with interactive Panzoom containers with fullscreen support.
 */
import { withKey } from '@/lib/api';
import { createPanzoomWrapper } from './panzoom';

export function initInlineSvgPanzoom(article: HTMLElement): () => void {
  const cleanups: (() => void)[] = [];
  const imgs = Array.from(article.querySelectorAll<HTMLImageElement>('img')).filter(
    (img) => /\.svg(\?|&|$)/i.test(img.getAttribute('src') ?? ''),
  );

  for (const img of imgs) {
    const src = img.getAttribute('src');
    if (!src) continue;

    const rawSrc = src.includes('raw=1') ? src : (src.includes('?') ? `${src}&raw=1` : `${src}?raw=1`);

    // Create a temporary placeholder
    const placeholder = document.createElement('div');
    placeholder.className = 'inline-svg-panzoom relative bg-white rounded-lg border border-border overflow-hidden my-4';
    placeholder.style.cursor = 'grab';
    placeholder.innerHTML = '<div class="overflow-hidden w-full min-h-[200px]"><div class="flex items-center justify-center p-4">Loading SVG…</div></div>';

    img.parentElement?.replaceChild(placeholder, img);

    // Fetch SVG content and init Panzoom
    fetch(withKey(rawSrc))
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch SVG: ${String(r.status)}`);
        return r.text();
      })
      .then((svgContent) => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = svgContent;
        const svg = tempDiv.querySelector('svg');
        if (!svg) throw new Error('No SVG element found');

        const { wrapper, cleanup } = createPanzoomWrapper(svg, placeholder, {
          wrapperExtraClass: 'inline-svg-panzoom',
          viewportMinHeight: '200px',
        });

        placeholder.replaceWith(wrapper);
        cleanups.push(cleanup);
      })
      .catch(() => {
        // Fallback: put the img back
        placeholder.replaceWith(img);
      });
  }

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
