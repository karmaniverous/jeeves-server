/**
 * Lazy-load embedded diagrams in markdown.
 *
 * Finds .embedded-diagram-lazy placeholders and fetches their rendered SVGs
 * via /api/diagram/:type/:hash.svg when they scroll into view.
 * After loading, initializes panzoom on the diagram.
 */
import Panzoom from '@panzoom/panzoom';
import { withKey } from '@/lib/api';

/**
 * Initialize lazy diagram loading for all placeholders in the given article.
 * Returns a cleanup function.
 */
export function initLazyDiagrams(article: HTMLElement): () => void {
  const cleanups: (() => void)[] = [];
  const placeholders = article.querySelectorAll<HTMLDivElement>('.embedded-diagram-lazy');

  if (placeholders.length === 0) return () => {};

  // Load all diagrams immediately — text is already visible,
  // diagrams render in parallel so they're ready when scrolled to.
  for (const placeholder of placeholders) {
    const type = placeholder.dataset.diagramType ?? 'diagram';
    placeholder.innerHTML = `<div class="embedded-diagram-loading"><div class="diagram-spinner"></div><span>Rendering ${type} diagram…</span></div>`;
    void loadDiagram(placeholder, cleanups);
  }

  return () => { for (const cleanup of cleanups) cleanup(); };
}

async function loadDiagram(
  placeholder: HTMLDivElement,
  cleanups: (() => void)[],
): Promise<void> {
  const type = placeholder.dataset.diagramType;
  const hash = placeholder.dataset.diagramHash;
  if (!type || !hash) return;

  try {
    const url = withKey(`/api/diagram/${type}/${hash}.svg`);
    const resp = await fetch(url);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Render failed' })) as { error?: string };
      throw new Error(err.error ?? `HTTP ${String(resp.status)}`);
    }
    const svgText = await resp.text();

    // Parse SVG, fix PlantUML sizing issues, and insert into panzoom container
    const container = document.createElement('div');
    container.className = 'embedded-diagram-rendered';
    container.dataset.type = type;
    container.innerHTML = svgText;

    // Fix PlantUML SVGs: they ship with preserveAspectRatio="none" which
    // causes vertical stretching when CSS constrains width.
    const svg = container.querySelector('svg');
    if (svg) {
      if (svg.getAttribute('preserveAspectRatio') === 'none') {
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      }
      // Remove inline width/height styles that conflict with responsive sizing
      svg.style.removeProperty('width');
      svg.style.removeProperty('height');
      // Set width="100%" and let viewBox + aspect ratio handle the rest
      svg.setAttribute('width', '100%');
      svg.removeAttribute('height');
    }

    placeholder.replaceWith(container);

    // Initialize panzoom on this container
    initPanzoomOnContainer(container, cleanups);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    placeholder.innerHTML = `<div class="embedded-diagram-error" data-type="${type}"><div class="diagram-error-label">${type} render failed: ${escapeHtml(message)}</div></div>`;
  }
}

function initPanzoomOnContainer(
  container: HTMLDivElement,
  cleanups: (() => void)[],
): void {
  const svg = container.querySelector('svg');
  if (!svg) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'embedded-diagram-panzoom relative bg-white rounded-lg border border-border overflow-hidden my-4';
  wrapper.style.cursor = 'grab';

  const viewport = document.createElement('div');
  viewport.className = 'overflow-hidden w-full';

  const inner = document.createElement('div');
  inner.className = 'flex items-center justify-center p-4 [&>svg]:max-w-full [&>svg]:h-auto';

  inner.appendChild(svg);
  viewport.appendChild(inner);

  // Fullscreen button
  const fsBtn = document.createElement('button');
  fsBtn.className = 'absolute top-2 right-2 z-10 p-1.5 bg-zinc-800/70 hover:bg-zinc-700 text-white rounded transition-colors';
  fsBtn.title = 'Fullscreen';
  fsBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';

  // Hint
  const hint = document.createElement('div');
  hint.className = 'text-xs text-muted-foreground text-center py-1 opacity-60';
  hint.textContent = 'Scroll to zoom · Drag to pan';

  wrapper.appendChild(viewport);
  wrapper.appendChild(fsBtn);
  wrapper.appendChild(hint);

  container.replaceWith(wrapper);

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
    inner.className = 'p-4 [&>svg]:max-w-full [&>svg]:h-auto';
    hint.textContent = 'Scroll to zoom · Drag to pan · Esc to close';
    hint.className = 'text-muted-foreground text-xs text-center py-2 pointer-events-none';
    fsBtn.title = 'Exit fullscreen';
    fsBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
    pz.destroy();
    requestAnimationFrame(() => {
      const s = inner.querySelector('svg');
      if (s && viewport.clientWidth && viewport.clientHeight) {
        const svgW = s.getBoundingClientRect().width || s.clientWidth || 1000;
        const svgH = s.getBoundingClientRect().height || s.clientHeight || 800;
        const fitScale = Math.min(viewport.clientWidth / svgW, viewport.clientHeight / svgH, 1);
        const scaledH = svgH * fitScale;
        const startY = (viewport.clientHeight - scaledH) / 2;
        const scaledW = svgW * fitScale;
        const startX = (viewport.clientWidth - scaledW) / 2;
        pz = Panzoom(inner, { maxScale: 20, minScale: fitScale * 0.5, startScale: fitScale, startX, startY });
      } else {
        pz = Panzoom(inner, { maxScale: 20, minScale: 0.1 });
      }
    });
  };

  const exitFullscreen = () => {
    isFullscreen = false;
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
