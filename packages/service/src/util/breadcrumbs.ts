/**
 * Breadcrumb filtering utilities.
 */

export interface Breadcrumb {
  label: string;
  path: string;
}

/**
 * Filter breadcrumbs for outsiders:
 * - File shares: no breadcrumbs (the page stands alone)
 * - Directory shares: trim to the share root (matchedPath)
 */
export function filterBreadcrumbsForOutsider(
  breadcrumbs: Breadcrumb[],
  isInsider: boolean,
  matchedPath: string | null,
  isDirectoryView: boolean,
): Breadcrumb[] {
  if (isInsider) return breadcrumbs;
  if (!isDirectoryView)
    return breadcrumbs.length > 0 ? [breadcrumbs[breadcrumbs.length - 1]] : [];
  // For directory views, trim breadcrumbs to the matched (shared) path root
  if (matchedPath) {
    const normalizedMatch = matchedPath.replace(/^\/+|\/+$/g, '').toLowerCase();
    const matchIdx = breadcrumbs.findIndex(
      (b) => b.path.replace(/^\/+|\/+$/g, '').toLowerCase() === normalizedMatch,
    );
    if (matchIdx >= 0) return breadcrumbs.slice(matchIdx);
  }
  return breadcrumbs;
}
