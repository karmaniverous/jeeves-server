import Panzoom from '@panzoom/panzoom';
import { useCallback, useEffect, useRef } from 'react';

interface SvgViewerProps {
  content: string;
}

export function SvgViewer({ content }: SvgViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const panzoomRef = useRef<ReturnType<typeof Panzoom> | null>(null);

  const initPanzoom = useCallback(() => {
    if (panzoomRef.current) {
      panzoomRef.current.destroy();
      panzoomRef.current = null;
    }
    if (!innerRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const inner = innerRef.current;
    const svg = inner.querySelector('svg');

    if (svg) {
      if (!svg.getAttribute('viewBox') && svg.getAttribute('width') && svg.getAttribute('height')) {
        const w = parseFloat(svg.getAttribute('width')!);
        const h = parseFloat(svg.getAttribute('height')!);
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      }
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }

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
    // Defer init to next frame so container has layout dimensions after mount
    let cleanupWheel: (() => void) | undefined;
    const frameId = requestAnimationFrame(() => {
      cleanupWheel = initPanzoom() ?? undefined;
    });
    return () => {
      cancelAnimationFrame(frameId);
      cleanupWheel?.();
      panzoomRef.current?.destroy();
    };
  }, [content, initPanzoom]);

  return (
    <div className="relative bg-white dark:bg-zinc-900 rounded-lg border border-border overflow-hidden">
      <div
        ref={containerRef}
        className="overflow-hidden cursor-grab active:cursor-grabbing w-full h-[calc(100vh-8rem)]"
      >
        <div
          ref={innerRef}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </div>
  );
}
