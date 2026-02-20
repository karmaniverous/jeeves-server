import Panzoom from '@panzoom/panzoom';
import { useCallback, useEffect, useMemo, useRef } from 'react';

interface SvgViewerProps {
  content: string;
}

interface SvgDimensions {
  html: string;
  intrinsicWidth: number;
  intrinsicHeight: number;
}

/**
 * Pre-process SVG content: extract intrinsic dimensions, ensure viewBox,
 * and set width/height to 100% for CSS-driven scaling.
 */
function prepareSvgContent(raw: string): SvgDimensions {
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return { html: raw, intrinsicWidth: 800, intrinsicHeight: 600 };

  // Extract intrinsic dimensions from viewBox or width/height attributes
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

  // Ensure viewBox exists
  if (!svg.getAttribute('viewBox') && w > 0 && h > 0) {
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }

  // Remove fixed dimensions — let CSS control size
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  // Make SVG fill its container
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.display = 'block';

  return {
    html: new XMLSerializer().serializeToString(doc),
    intrinsicWidth: w > 0 ? w : 800,
    intrinsicHeight: h > 0 ? h : 600,
  };
}

export function SvgViewer({ content }: SvgViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const panzoomRef = useRef<ReturnType<typeof Panzoom> | null>(null);

  const prepared = useMemo(() => prepareSvgContent(content), [content]);

  const initPanzoom = useCallback(() => {
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

    // Size the inner div to match the SVG's aspect ratio at a large base size.
    // Panzoom transforms this div; the SVG inside scales via CSS 100%/100%.
    const svgW = prepared.intrinsicWidth;
    const svgH = prepared.intrinsicHeight;

    // Set inner to intrinsic SVG size — panzoom will scale it
    inner.style.width = `${svgW}px`;
    inner.style.height = `${svgH}px`;
    inner.style.transformOrigin = '0 0';

    // Calculate zoom-to-fit scale
    const scaleX = cw / svgW;
    const scaleY = ch / svgH;
    const fitScale = Math.min(scaleX, scaleY, 1); // don't upscale past 1:1

    const pz = Panzoom(inner, {
      maxScale: 20,
      minScale: fitScale * 0.5,
      startScale: fitScale,
      startX: (cw - svgW * fitScale) / 2,
      startY: (ch - svgH * fitScale) / 2,
      contain: 'outside',
    });
    panzoomRef.current = pz;

    const wheelHandler = (e: WheelEvent) => {
      pz.zoomWithWheel(e);
    };
    container.addEventListener('wheel', wheelHandler, { passive: false });
    return () => container.removeEventListener('wheel', wheelHandler);
  }, [prepared]);

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
  }, [prepared, initPanzoom]);

  // Re-init on window resize for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      requestAnimationFrame(() => initPanzoom());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initPanzoom]);

  return (
    <div className="relative bg-white dark:bg-zinc-900 rounded-lg border border-border overflow-hidden">
      <div
        ref={containerRef}
        className="overflow-hidden cursor-grab active:cursor-grabbing w-full h-[calc(100vh-8rem)]"
      >
        <div
          ref={innerRef}
          dangerouslySetInnerHTML={{ __html: prepared.html }}
        />
      </div>
    </div>
  );
}
