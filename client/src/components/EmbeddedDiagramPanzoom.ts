/**
 * Add Panzoom to embedded diagram SVGs rendered server-side in markdown.
 * 
 * Finds .embedded-diagram-rendered containers with inline <svg> elements
 * and wraps them with Panzoom for wheel-zoom and drag-pan.
 */
import Panzoom from '@panzoom/panzoom';

export function initEmbeddedDiagramPanzoom(article: HTMLElement): () => void {
  const cleanups: (() => void)[] = [];

  const containers = article.querySelectorAll<HTMLDivElement>('.embedded-diagram-rendered');

  for (const container of containers) {
    const svg = container.querySelector('svg');
    if (!svg) continue;

    // Create panzoom wrapper structure
    const wrapper = document.createElement('div');
    wrapper.className = 'embedded-diagram-panzoom relative bg-white rounded-lg border border-border overflow-hidden my-4';
    wrapper.style.cursor = 'grab';

    const viewport = document.createElement('div');
    viewport.className = 'overflow-hidden w-full';

    const inner = document.createElement('div');
    inner.className = 'flex items-center justify-center p-4 [&>svg]:max-w-full [&>svg]:h-auto';

    // Move SVG into panzoom inner
    inner.appendChild(svg);
    viewport.appendChild(inner);

    // Fullscreen button
    const fsBtn = document.createElement('button');
    fsBtn.className = 'absolute top-2 right-2 z-10 p-1.5 bg-zinc-800/70 hover:bg-zinc-700 text-white rounded transition-colors';
    fsBtn.title = 'Fullscreen';
    fsBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';

    // Hint text
    const hint = document.createElement('div');
    hint.className = 'text-xs text-muted-foreground text-center py-1 opacity-60';
    hint.textContent = 'Scroll to zoom · Drag to pan';

    wrapper.appendChild(viewport);
    wrapper.appendChild(fsBtn);
    wrapper.appendChild(hint);

    // Replace the original container
    container.replaceWith(wrapper);

    // Init panzoom
    let pz = Panzoom(inner, { maxScale: 20, contain: 'outside' });

    const wheelHandler = (e: WheelEvent) => { pz.zoomWithWheel(e); };
    viewport.addEventListener('wheel', wheelHandler, { passive: false });

    let isFullscreen = false;

    const enterFullscreen = () => {
      isFullscreen = true;
      wrapper.dataset.origClass = wrapper.className;
      wrapper.className = 'fixed inset-0 z-[100] bg-white dark:bg-zinc-900 flex flex-col';
      wrapper.style.cursor = 'grab';
      viewport.className = 'overflow-hidden w-full h-full flex-1';
      inner.className = 'p-4';
      hint.textContent = 'Scroll to zoom · Drag to pan · Esc to close';
      hint.className = 'text-muted-foreground text-xs text-center py-2 pointer-events-none';
      fsBtn.title = 'Exit fullscreen';
      fsBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
      pz.destroy();
      requestAnimationFrame(() => { requestAnimationFrame(() => { setTimeout(() => {
        const s = inner.querySelector('svg');
        if (s && viewport.clientWidth && viewport.clientHeight) {
          const vb = s.getAttribute('viewBox');
          let svgW: number, svgH: number;
          if (vb) {
            const parts = vb.split(/[\s,]+/).map(Number);
            svgW = parts[2] || 1000;
            svgH = parts[3] || 800;
          } else {
            svgW = s.clientWidth || 1000;
            svgH = s.clientHeight || 800;
          }
          const vw = viewport.clientWidth;
          const vh = viewport.clientHeight;
          const fitScale = Math.min(vw / svgW, vh / svgH, 1);
          const fittedW = svgW * fitScale;
          const fittedH = svgH * fitScale;
          s.setAttribute('width', String(Math.round(fittedW)));
          s.setAttribute('height', String(Math.round(fittedH)));
          s.style.width = `${String(Math.round(fittedW))}px`;
          s.style.height = `${String(Math.round(fittedH))}px`;
          const startX = (vw - fittedW) / 2;
          const startY = (vh - fittedH) / 2;
          pz = Panzoom(inner, { maxScale: 20 / fitScale, minScale: 0.5, startScale: 1, startX, startY });
        } else {
          pz = Panzoom(inner, { maxScale: 20, minScale: 0.1 });
        }
      }, 50); }); });
    };

    const exitFullscreen = () => {
      isFullscreen = false;
      const s = inner.querySelector('svg');
      if (s) {
        s.setAttribute('width', '100%');
        s.removeAttribute('height');
        s.style.width = '';
        s.style.height = '';
      }
      wrapper.className = wrapper.dataset.origClass ?? 'embedded-diagram-panzoom relative bg-white rounded-lg border border-border overflow-hidden my-4';
      wrapper.style.cursor = 'grab';
      viewport.className = 'overflow-hidden w-full';
      inner.className = 'flex items-center justify-center p-4 [&>svg]:max-w-full [&>svg]:h-auto';
      hint.textContent = 'Scroll to zoom · Drag to pan';
      hint.className = 'text-xs text-muted-foreground text-center py-1 opacity-60';
      fsBtn.title = 'Fullscreen';
      fsBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
      pz.destroy();
      pz = Panzoom(inner, { maxScale: 20, contain: 'outside', startScale: 1 });
    };

    fsBtn.addEventListener('click', () => {
      if (isFullscreen) exitFullscreen(); else enterFullscreen();
    });

    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) exitFullscreen();
    };
    document.addEventListener('keydown', escHandler);

    cleanups.push(() => {
      viewport.removeEventListener('wheel', wheelHandler);
      document.removeEventListener('keydown', escHandler);
      pz.destroy();
    });
  }

  return () => { for (const cleanup of cleanups) cleanup(); };
}
