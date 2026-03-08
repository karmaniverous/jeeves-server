/**
 * Top bar height measurement for sticky layout.
 *
 * @param depsKey - Serialized dependency key (e.g. JSON.stringify([val1, val2])).
 *   When this value changes, the top bar height is re-measured.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export function useTopBar(depsKey = '') {
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

  useEffect(() => { measureTopBar(); }, [measureTopBar, depsKey]);

  return { topBarRef, mainRef, topBarHeight };
}
