/**
 * Post-processes a rendered markdown article to add Panzoom to embedded SVG images.
 * 
 * Finds <img> elements with .svg sources, fetches the SVG content,
 * and replaces them with interactive Panzoom containers with fullscreen support.
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

    // Fullscreen button
    const fsBtn = document.createElement('button');
    fsBtn.className = 'absolute top-2 right-2 z-10 p-1.5 bg-zinc-800/70 hover:bg-zinc-700 text-white rounded transition-colors';
    fsBtn.title = 'Fullscreen';
    fsBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';

    container.appendChild(inner);
    wrapper.appendChild(container);
    wrapper.appendChild(fsBtn);

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

        let pz = Panzoom(inner, {
          maxScale: 20,
          contain: 'outside',
        });

        const wheelHandler = (e: WheelEvent) => {
          pz.zoomWithWheel(e);
        };
        container.addEventListener('wheel', wheelHandler, { passive: false });

        // Hint text
        const hint = document.createElement('div');
        hint.className = 'text-xs text-muted-foreground text-center py-1 opacity-60';
        hint.textContent = 'Scroll to zoom · Drag to pan';
        wrapper.appendChild(hint);

        let isFullscreen = false;

        const enterFullscreen = () => {
          isFullscreen = true;
          // Save original styles
          wrapper.dataset.origClass = wrapper.className;
          wrapper.className = 'fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center';
          wrapper.style.cursor = 'grab';
          container.className = 'overflow-hidden w-full h-full flex-1';
          hint.textContent = 'Scroll to zoom · Drag to pan · Esc to close';
          hint.className = 'text-zinc-400 text-xs text-center py-2 pointer-events-none';
          fsBtn.title = 'Exit fullscreen';
          fsBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
          // Reinit panzoom — fit SVG to viewport
          pz.destroy();
          requestAnimationFrame(() => {
            const svg = inner.querySelector('svg');
            if (svg && container.clientWidth && container.clientHeight) {
              const svgW = svg.getBoundingClientRect().width || svg.clientWidth || 1000;
              const svgH = svg.getBoundingClientRect().height || svg.clientHeight || 800;
              const fitScale = Math.min(
                container.clientWidth / svgW,
                container.clientHeight / svgH,
                1 // Don't upscale beyond 1x
              );
              // Center vertically: offset by half the difference between container and scaled SVG
              const scaledH = svgH * fitScale;
              const startY = (container.clientHeight - scaledH) / 2;
              const scaledW = svgW * fitScale;
              const startX = (container.clientWidth - scaledW) / 2;
              pz = Panzoom(inner, { maxScale: 20, minScale: fitScale * 0.5, startScale: fitScale, startX, startY });
            } else {
              pz = Panzoom(inner, { maxScale: 20, minScale: 0.1 });
            }
          });
        };

        const exitFullscreen = () => {
          isFullscreen = false;
          wrapper.className = wrapper.dataset.origClass ?? 'inline-svg-panzoom relative bg-white rounded-lg border border-border overflow-hidden my-4';
          wrapper.style.cursor = 'grab';
          container.className = 'overflow-hidden w-full min-h-[200px]';
          hint.textContent = 'Scroll to zoom · Drag to pan';
          hint.className = 'text-xs text-muted-foreground text-center py-1 opacity-60';
          fsBtn.title = 'Fullscreen';
          fsBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
          // Reinit panzoom for original inline size
          pz.destroy();
          pz = Panzoom(inner, { maxScale: 20, contain: 'outside', startScale: 1 });
        };

        fsBtn.addEventListener('click', () => {
          if (isFullscreen) exitFullscreen();
          else enterFullscreen();
        });

        const escHandler = (e: KeyboardEvent) => {
          if (e.key === 'Escape' && isFullscreen) exitFullscreen();
        };
        document.addEventListener('keydown', escHandler);

        cleanups.push(() => {
          container.removeEventListener('wheel', wheelHandler);
          document.removeEventListener('keydown', escHandler);
          pz.destroy();
        });
      })
      .catch(() => {
        // Fallback: put the img back
        inner.innerHTML = '';
        inner.appendChild(img);
        fsBtn.remove();
      });
  }

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
