/**
 * Calls back on a mouse-down outside an element, while active: closes
 * dropdowns and popovers.
 */
import { type RefObject, useEffect } from 'react';

import { useLatestRef } from './useLatestRef';

/**
 * While `active`, call `onOutside` on every `mousedown` whose target lies
 * outside `ref`'s element.
 *
 * @param ref - The element clicks must fall outside of.
 * @param active - Whether to listen (e.g. the dropdown is open).
 * @param onOutside - Called on an outside mouse-down.
 * @param capture - Listen in the capture phase.
 */
export function useOutsideClick(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onOutside: () => void,
  capture = false,
): void {
  const onOutsideRef = useLatestRef(onOutside);
  useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOutsideRef.current();
      }
    };
    document.addEventListener('mousedown', handler, capture);
    return () => document.removeEventListener('mousedown', handler, capture);
  }, [active, capture, ref, onOutsideRef]);
}
