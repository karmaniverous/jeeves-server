/**
 * Which rendered Markdown block the pointer is over, debounced: event delegation on the container, the hovered element and its overlay rectangle, cleared when the content re-renders.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  computeOverlayRect,
  findHoverTarget,
  type OverlayRect,
} from '@/components/blockHoverDom';

/** Debounce delay (ms) before switching hovered element. */
const HOVER_DEBOUNCE_MS = 200;

/**
 * Track the hovered block in `containerRef`.
 *
 * @param containerRef - The rendered content.
 * @param html - The rendered HTML (a change clears the hover).
 * @param disabled - Whether hover tracking is off.
 * @returns The hovered element and rectangle, the controls' ref (pointer
 *   moves into it keep the hover) and a way to clear the hover.
 */
export function useBlockHover(
  containerRef: React.RefObject<HTMLElement | null>,
  html: string | null | undefined,
  disabled: boolean,
) {
  const [hoveredEl, setHoveredEl] = useState<Element | null>(null);
  const [hoverRect, setHoverRect] = useState<OverlayRect | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingElRef = useRef<Element | null>(null);

  const clearHover = useCallback(() => {
    setHoveredEl(null);
    setHoverRect(null);
  }, []);

  // Clear hover when content re-renders (adjusting state during render pattern)
  const [prevHtml, setPrevHtml] = useState(html);
  if (html !== prevHtml) {
    setPrevHtml(html);
    setHoveredEl(null);
    setHoverRect(null);
  }

  // Debounced hover setter — computes rect in the timer callback (not during render)
  const setHoveredDebounced = useCallback(
    (el: Element | null) => {
      if (hoverTimerRef.current !== null) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      pendingElRef.current = el;
      hoverTimerRef.current = setTimeout(() => {
        hoverTimerRef.current = null;
        const pending = pendingElRef.current;
        const container = containerRef.current;
        if (!pending || !container) {
          clearHover();
          return;
        }
        setHoveredEl(pending);
        setHoverRect(computeOverlayRect(pending, container));
      }, HOVER_DEBOUNCE_MS);
    },
    [containerRef, clearHover],
  );

  // Hover detection via event delegation
  useEffect(() => {
    if (disabled) return;
    const container = containerRef.current;
    if (!container) return;

    function handleMouseOver(e: MouseEvent) {
      const target = e.target as Element;
      const block = findHoverTarget(target, e.clientY);
      setHoveredDebounced(block);
    }

    function handleMouseOut(e: MouseEvent) {
      const related = e.relatedTarget as Element | null;
      if (!related) {
        setHoveredDebounced(null);
        return;
      }
      if (controlsRef.current?.contains(related)) return;
      const container_ = containerRef.current;
      if (!container_?.contains(related)) {
        setHoveredDebounced(null);
        return;
      }
      const block = findHoverTarget(related, e.clientY);
      if (!block) setHoveredDebounced(null);
    }

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseout', handleMouseOut);
    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseout', handleMouseOut);
      if (hoverTimerRef.current !== null) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
    };
  }, [disabled, containerRef, setHoveredDebounced]);

  return { hoveredEl, hoverRect, controlsRef, clearHover };
}
