import Panzoom from '@panzoom/panzoom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface SvgViewerProps {
  content: string;
}

/**
 * Pre-process SVG content: ensure viewBox exists, strip fixed sizing,
 * set preserveAspectRatio so the SVG zoom-to-fits its container natively.
 */
function prepareSvgContent(raw: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return raw;

  // Extract intrinsic dimensions for viewBox if missing
  let w = 0, h = 0;
  const viewBox = svg.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number);
    if (parts.length === 4) {
      w = parts[2];
      h = parts[3];
    }
  }
  if (w <= 0 || h <= 0) {
    w = parseFloat(svg.getAttribute('width') ?? '0');
    h = parseFloat(svg.getAttribute('height') ?? '0');
  }

  // Ensure viewBox exists (required for scaling)
  if (!svg.getAttribute('viewBox') && w > 0 && h > 0) {
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }

  // Strip ALL fixed sizing — attributes AND inline styles
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.style.removeProperty('width');
  svg.style.removeProperty('height');
  svg.style.removeProperty('background');

  // Fill container, maintain aspect ratio
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.style.display = 'block';

  return new XMLSerializer().serializeToString(doc);
}

export function SvgViewer({ content }: SvgViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const panzoomRef = useRef<ReturnType<typeof Panzoom> | null>(null);
  const wheelCleanupRef = useRef<(() => void) | null>(null);
  const [ready, setReady] = useState(false);

  const html = useMemo(() => prepareSvgContent(content), [content]);

  const initPanzoom = useCallback(() => {
    // Clean up previous instance
    wheelCleanupRef.current?.();
    wheelCleanupRef.current = null;
    if (panzoomRef.current) {
      panzoomRef.current.destroy();
      panzoomRef.current = null;
    }
    if (!innerRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const inner = innerRef.current;
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    if (cw === 0 || ch === 0) return;

    // Inner div fills the container; the SVG inside zoom-to-fits via
    // viewBox + preserveAspectRatio. Panzoom then handles user zoom/pan
    // starting from this natural fit.
    inner.style.width = `${cw}px`;
    inner.style.height = `${ch}px`;

    const pz = Panzoom(inner, {
      maxScale: 20,
      minScale: 0.1,
      startScale: 1,
    });
    panzoomRef.current = pz;

    const wheelHandler = (e: WheelEvent) => {
      pz.zoomWithWheel(e);
    };
    container.addEventListener('wheel', wheelHandler, { passive: false });
    wheelCleanupRef.current = () => container.removeEventListener('wheel', wheelHandler);

    setReady(true);
  }, [html]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      initPanzoom();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      wheelCleanupRef.current?.();
      panzoomRef.current?.destroy();
    };
  }, [initPanzoom]);

  return (
    <div className="relative bg-white dark:bg-zinc-900 rounded-lg border border-border overflow-hidden">
      <div
        ref={containerRef}
        className="overflow-hidden cursor-grab active:cursor-grabbing w-full h-[calc(100vh-8rem)]"
      >
        <div
          ref={innerRef}
          className={ready ? '' : 'invisible'}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
