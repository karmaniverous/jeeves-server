/**
 * Task-list checkboxes in rendered Markdown: enabled for insiders (disabled otherwise) whenever the HTML changes, and a toggle sent to the API as a `toggle-checkbox` mutation.
 */
import { useCallback, useEffect, useLayoutEffect } from 'react';

import { server } from '@/lib/server';

/**
 * Wire the checkboxes of the article in `articleRef`.
 *
 * @param articleRef - The rendered article.
 * @param html - The rendered HTML (re-applied on change).
 * @param isInsider - Whether the viewer may toggle them.
 * @param reqPath - The file's browse path.
 */
export function useTaskCheckboxes(
  articleRef: React.RefObject<HTMLElement | null>,
  html: string | null | undefined,
  isInsider: boolean | undefined,
  reqPath: string,
): void {
  // Enable/disable checkboxes — runs via useLayoutEffect (synchronous, before
  // paint) so checkboxes are interactive as soon as the DOM is visible.
  // Uses removeAttribute to strip the HTML content attribute, not just the IDL
  // property — mobile WebViews (e.g. Slack) may not reflect .disabled=false
  // to the content attribute, leaving the checkbox visually enabled but
  // unresponsive to taps.
  const enableCheckboxes = useCallback(
    (el: HTMLElement) => {
      const checkboxes = el.querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"][data-checkbox-index]',
      );
      checkboxes.forEach((cb) => {
        if (isInsider) {
          cb.removeAttribute('disabled');
          cb.disabled = false;
          cb.style.cursor = 'pointer';
        } else {
          cb.setAttribute('disabled', '');
          cb.disabled = true;
          cb.style.cursor = '';
        }
      });
    },
    [isInsider],
  );

  useLayoutEffect(() => {
    const el = articleRef.current;
    if (el) enableCheckboxes(el);
  }, [articleRef, html, enableCheckboxes]);

  // Delegated change handler on the article element — survives innerHTML
  // replacement because it's bound to the stable parent, not individual
  // checkbox nodes. Uses native addEventListener rather than React's onChange
  // because the checkboxes are injected via dangerouslySetInnerHTML and we
  // need guaranteed compatibility with mobile WebViews.
  useEffect(() => {
    const el = articleRef.current;
    if (!el || !isInsider) return;

    function handleChange(e: Event) {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.type !== 'checkbox') return;
      const indexAttr = target.getAttribute('data-checkbox-index');
      if (indexAttr === null) return;
      const index = parseInt(indexAttr, 10);
      const checked = target.checked;
      server
        .fileMutate({ '*': reqPath, action: 'toggle-checkbox', index, checked })
        .catch(() => console.warn('Checkbox toggle failed for index', index));
    }

    el.addEventListener('change', handleChange);
    return () => {
      el.removeEventListener('change', handleChange);
    };
  }, [articleRef, isInsider, reqPath]);
}
