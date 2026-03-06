/**
 * Add Panzoom to embedded diagram SVGs rendered server-side in markdown.
 *
 * Finds .embedded-diagram-rendered containers with inline <svg> elements
 * and wraps them with Panzoom for wheel-zoom and drag-pan.
 */
import { createPanzoomWrapper } from './panzoom';

export function initEmbeddedDiagramPanzoom(article: HTMLElement): () => void {
  const cleanups: (() => void)[] = [];

  const containers = article.querySelectorAll<HTMLDivElement>('.embedded-diagram-rendered');

  for (const container of containers) {
    const svg = container.querySelector('svg');
    if (!svg) continue;

    const { wrapper, initPanzoom, cleanup } = createPanzoomWrapper(svg, container, {
      wrapperExtraClass: 'embedded-diagram-panzoom',
    });

    container.replaceWith(wrapper);
    initPanzoom();
    cleanups.push(cleanup);
  }

  return () => { for (const cleanup of cleanups) cleanup(); };
}
