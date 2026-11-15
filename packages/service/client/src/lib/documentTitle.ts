/**
 * The browser tab title (#262): `{title} - {branding.name}` while a page
 * has a title (an open file's document title), just `{branding.name}`
 * otherwise. Pages set it; `BrandingProvider` doesn't.
 */
import { useEffect } from 'react';

import { useBranding } from './BrandingContext';

/**
 * The tab title for a page title.
 *
 * @param title - The page's title; empty or absent for none.
 * @param brand - `branding.name`.
 * @returns `{title} - {brand}`, or `brand` without a title.
 */
export function formatDocumentTitle(
  title: string | null | undefined,
  brand: string,
): string {
  return title ? `${title} - ${brand}` : brand;
}

/**
 * Set `document.title` for a page, again whenever the title or the brand
 * name changes.
 *
 * @param title - The page's title; `null` for none.
 */
export function useDocumentTitle(title: string | null | undefined): void {
  const { name } = useBranding();
  useEffect(() => {
    document.title = formatDocumentTitle(title, name);
  }, [title, name]);
}
