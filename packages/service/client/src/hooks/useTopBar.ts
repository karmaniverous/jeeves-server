/**
 * Top bar height measurement for sticky layout.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export function useTopBar(deps: unknown[] = []) {
  const topBarRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [topBarHeight, setTopBarHeight] = useState(96);

  const measureTopBar = useCallback(() => {
    if (topBarRef.current) setTopBarHeight(topBarRef.current.offsetHeight);
  }, []);

  useEffect(() => {
    measureTopBar();
    window.addEventListener('resize', measureTopBar);
    return () => window.removeEventListener('resize', measureTopBar);
  }, [measureTopBar]);

  useEffect(() => { measureTopBar(); }, [measureTopBar, ...deps]);

  return { topBarRef, mainRef, topBarHeight };
}
