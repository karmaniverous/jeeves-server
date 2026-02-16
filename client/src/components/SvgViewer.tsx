import Panzoom from '@panzoom/panzoom';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface SvgViewerProps {
  content: string;
}

export function SvgViewer({ content }: SvgViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const panzoomRef = useRef<ReturnType<typeof Panzoom> | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const initPanzoom = useCallback(() => {
    if (panzoomRef.current) {
      panzoomRef.current.destroy();
      panzoomRef.current = null;
    }
    if (innerRef.current) {
      const pz = Panzoom(innerRef.current, {
        maxScale: 20,
        contain: 'outside',
      });
      panzoomRef.current = pz;

      const container = containerRef.current;
      if (container) {
        const wheelHandler = (e: WheelEvent) => {
          pz.zoomWithWheel(e);
        };
        container.addEventListener('wheel', wheelHandler, { passive: false });
        return () => container.removeEventListener('wheel', wheelHandler);
      }
    }
  }, []);

  useEffect(() => {
    const cleanup = initPanzoom();
    return () => {
      cleanup?.();
      panzoomRef.current?.destroy();
    };
  }, [content, fullscreen, initPanzoom]);

  const toggleFullscreen = () => setFullscreen(!fullscreen);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && fullscreen) {
      setFullscreen(false);
    }
  };

  const wrapperClass = fullscreen
    ? 'fixed inset-0 z-[100] bg-black/90 flex items-center justify-center'
    : 'relative bg-white rounded-lg border border-border overflow-hidden';

  return (
    <div
      className={wrapperClass}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <button
        onClick={toggleFullscreen}
        className="absolute top-2 right-2 z-10 p-1.5 bg-zinc-800/70 hover:bg-zinc-700 text-white rounded transition-colors"
        title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      >
        {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>

      {fullscreen && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-zinc-400 text-xs pointer-events-none">
          Scroll to zoom · Drag to pan · Esc to close
        </div>
      )}

      <div
        ref={containerRef}
        className={`overflow-hidden cursor-grab active:cursor-grabbing ${fullscreen ? 'w-full h-full' : 'w-full min-h-[200px]'}`}
      >
        <div
          ref={innerRef}
          className="flex items-center justify-center p-4 [&>svg]:max-w-full [&>svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </div>
  );
}
