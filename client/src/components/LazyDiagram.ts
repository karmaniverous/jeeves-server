/**
 * Lazy-load embedded diagrams in markdown.
 *
 * Finds .embedded-diagram-lazy placeholders and fetches their rendered SVGs
 * via /api/diagram/:type/:hash.svg when they scroll into view.
 * After loading, initializes panzoom on the diagram.
 */
import { withKey } from '@/lib/api';
import { normalizeSvg } from '@/lib/svg';
import { createPanzoomWrapper } from './panzoom';

/**
 * Initialize lazy diagram loading for all placeholders in the given article.
 * Returns a cleanup function.
 */
export function initLazyDiagrams(article: HTMLElement): () => void {
  const cleanups: (() => void)[] = [];
  const placeholders = article.querySelectorAll<HTMLDivElement>('.embedded-diagram-lazy');

  if (placeholders.length === 0) return () => {};

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

    // Normalize SVG for responsive display
    const normalizedSvg = normalizeSvg(svgText);

    const container = document.createElement('div');
    container.className = 'embedded-diagram-rendered';
    container.dataset.type = type;
    container.innerHTML = normalizedSvg;

    const svg = container.querySelector('svg');
    if (!svg) {
      placeholder.replaceWith(container);
      return;
    }

    // Use shared panzoom wrapper
    const { wrapper, initPanzoom, cleanup } = createPanzoomWrapper(svg, container, {
      wrapperExtraClass: 'embedded-diagram-panzoom',
    });

    placeholder.replaceWith(wrapper);
    initPanzoom();
    cleanups.push(cleanup);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    placeholder.innerHTML = `<div class="embedded-diagram-error" data-type="${type}"><div class="diagram-error-label">${type} render failed: ${escapeHtml(message)}</div></div>`;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
