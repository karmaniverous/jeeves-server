import Panzoom from '@panzoom/panzoom';
import { useCallback, useEffect, useMemo, useRef } from 'react';

interface SvgViewerProps {
  content: string;
}

/**
 * Pre-process SVG content to ensure it scales properly via CSS.
 * Sets width/height to 100% and preserveAspectRatio to xMidYMid meet,
 * ensuring a viewBox exists for proper scaling.
 */
function prepareSvgContent(raw: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return raw;

  // Ensure viewBox exists
  if (!svg.getAttribute('viewBox')) {
    const w = parseFloat(svg.getAttribute('width') ?? '0');
    const h = parseFloat(svg.getAttribute('height') ?? '0');
    if (w > 0 && h > 0) {
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    }
  }

  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  return new XMLSerializer().serializeToString(doc);
}

export function SvgViewer({ content }: SvgViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const panzoomRef = useRef<ReturnType<typeof Panzoom> | null>(null);

  // Pre-process SVG so it renders at container size from the start (no flash of intrinsic size)
  const preparedContent = useMemo(() => prepareSvgContent(content), [content]);

  const initPanzoom = useCallback(() => {
    if (panzoomRef.current) {
      panzoomRef.current.destroy();
      panzoomRef.current = null;
    }
    if (!innerRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const inner = innerRef.current;

    inner.style.width = `${container.clientWidth}px`;
    inner.style.height = `${container.clientHeight}px`;

    const pz = Panzoom(inner, {
      maxScale: 20,
      contain: 'outside',
    });
    panzoomRef.current = pz;

    const wheelHandler = (e: WheelEvent) => {
      pz.zoomWithWheel(e);
    };
    container.addEventListener('wheel', wheelHandler, { passive: false });
    return () => container.removeEventListener('wheel', wheelHandler);
  }, []);

  useEffect(() => {
    // Defer to ensure container has layout dimensions
    let cleanupWheel: (() => void) | undefined;
    const frameId = requestAnimationFrame(() => {
      cleanupWheel = initPanzoom() ?? undefined;
    });
    return () => {
      cancelAnimationFrame(frameId);
      cleanupWheel?.();
      panzoomRef.current?.destroy();
    };
  }, [preparedContent, initPanzoom]);

  return (
    <div className="relative bg-white dark:bg-zinc-900 rounded-lg border border-border overflow-hidden">
      <div
        ref={containerRef}
        className="overflow-hidden cursor-grab active:cursor-grabbing w-full h-[calc(100vh-8rem)]"
      >
        <div
          ref={innerRef}
          dangerouslySetInnerHTML={{ __html: preparedContent }}
        />
      </div>
    </div>
  );
}
