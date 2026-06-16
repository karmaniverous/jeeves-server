/**
 * Read-only CodeMirror 6 viewer with syntax highlighting, code folding,
 * and a unified toolbar (word-wrap toggle + copy).
 */
import { useEffect, useRef } from 'react';

import { mountCm6, shouldDefaultWrap } from '@/lib/codeBlockMount';
import { useTheme } from '@/lib/theme';

interface CodeViewerProps {
  content: string;
  fileName: string;
}

export function CodeViewer({ content, fileName }: CodeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [theme] = useTheme();

  const dotIndex = fileName.lastIndexOf('.');
  const ext = dotIndex >= 0 ? fileName.slice(dotIndex + 1) : '';
  const defaultWrap = shouldDefaultWrap(ext);

  useEffect(() => {
    if (!containerRef.current) return;

    let cleanup: (() => void) | null = null;
    let destroyed = false;

    void mountCm6(containerRef.current, content, ext, {
      defaultWrap,
      theme,
    }).then((fn) => {
      if (destroyed) {
        fn();
      } else {
        cleanup = fn;
      }
    });

    return () => {
      destroyed = true;
      cleanup?.();
    };
  }, [content, ext, defaultWrap, theme]);

  return <div ref={containerRef} className="rounded-lg overflow-hidden" />;
}
