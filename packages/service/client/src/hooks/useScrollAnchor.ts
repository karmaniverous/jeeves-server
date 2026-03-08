/**
 * Scroll anchoring hook.
 *
 * Observes a scrollable container for content height changes (e.g. lazy diagram
 * renders replacing placeholders with SVGs). When content above the current
 * viewport grows, compensates the scroll position so the user's reading position
 * remains stable.
 *
 * Uses ResizeObserver on the content element inside the scroll container.
 */
import { useEffect, useRef } from 'react';

/**
 * Attach scroll anchoring to a scrollable container.
 *
 * @param scrollRef - Ref to the scrollable container (the element with overflow-y).
 * @param contentRef - Ref to the content element inside the scroller whose height may change.
 * @param active - Whether anchoring is active (disable during programmatic scrolls).
 */
export function useScrollAnchor(
  scrollRef: React.RefObject<HTMLElement | null>,
  contentRef: React.RefObject<HTMLElement | null>,
  active = true,
): void {
  const prevHeight = useRef<number>(0);
  const prevScrollTop = useRef<number>(0);

  useEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!scroller || !content || !active) return;

    // Snapshot initial state
    prevHeight.current = content.scrollHeight;
    prevScrollTop.current = scroller.scrollTop;

    // Track scroll position
    const onScroll = () => {
      prevScrollTop.current = scroller.scrollTop;
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });

    // Observe content size changes
    const observer = new ResizeObserver(() => {
      const newHeight = content.scrollHeight;
      const oldHeight = prevHeight.current;
      const delta = newHeight - oldHeight;

      if (Math.abs(delta) > 0 && prevScrollTop.current > 0) {
        // Only compensate if content grew above the current scroll position.
        // If the scroller's scrollTop hasn't changed but scrollHeight grew,
        // the browser didn't auto-adjust, meaning growth was above viewport.
        const currentScrollTop = scroller.scrollTop;
        if (currentScrollTop === prevScrollTop.current && delta > 0) {
          scroller.scrollTop = currentScrollTop + delta;
        }
        prevScrollTop.current = scroller.scrollTop;
      }

      prevHeight.current = newHeight;
    });

    observer.observe(content);

    return () => {
      scroller.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, [scrollRef, contentRef, active]);
}
