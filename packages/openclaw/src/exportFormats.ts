/**
 * Which export formats `server_export` offers for a path, and where each one is served: taken from the server's link-info `exportLinks` (#320), so documents the watcher renders as Markdown export to PDF/DOCX like native Markdown. Pure.
 *
 * @packageDocumentation
 */

import type { ExportFormat } from '@karmaniverous/jeeves-server-sdk';

/** Every format the tool's `format` parameter accepts, in listed order. */
export const EXPORT_FORMATS: readonly ExportFormat[] = [
  'pdf',
  'docx',
  'zip',
  'tar',
  'svg',
  'png',
];

/** An export link as link-info reports it. */
interface ExportLink {
  /** Export format. */
  format: string;
  /** Export URL (server-relative). */
  url: string;
}

/** The `/api/<route>/` prefix of a server-relative export URL. */
const ROUTE = /^\/api\/[^/?#]+\//;

/** The pathname prefix of a page URL. */
const BROWSE = '/browse/';

/** Whether link-info's format is one the tool's `format` parameter accepts. */
const isExportFormat = (format: string): boolean =>
  (EXPORT_FORMATS as readonly string[]).includes(format);

/**
 * Export routes by format, from link-info's export links: each link's
 * `/api/<route>/` prefix. Formats the tool doesn't accept are dropped (a
 * PlantUML jar lists `eps`). A directory offering `zip` offers `tar` on the
 * same route too (link-info lists `zip` only, and only for insiders).
 *
 * @param links - link-info's `exportLinks` (none when omitted).
 * @param isDirectory - Whether the path is a directory.
 * @returns The route of each format, in link-info's order.
 */
export function exportRoutesOf(
  links: readonly ExportLink[] = [],
  isDirectory: boolean,
): ReadonlyMap<string, string> {
  const routes = new Map<string, string>();
  for (const { format, url } of links) {
    const route = ROUTE.exec(url)?.[0];
    if (route !== undefined && isExportFormat(format) && !routes.has(format))
      routes.set(format, route);
  }
  const zip = routes.get('zip');
  if (isDirectory && zip !== undefined && !routes.has('tar'))
    routes.set('tar', zip);
  return routes;
}

/**
 * Why a path can't be exported in a format, naming the formats it has.
 *
 * @param path - Browse path.
 * @param format - The format asked for.
 * @param valid - The formats link-info offers.
 * @param isDirectory - Whether the path is a directory.
 * @returns The error message.
 */
export function unavailableFormatMessage(
  path: string,
  format: string,
  valid: readonly string[],
  isDirectory: boolean,
): string {
  if (valid.length > 0)
    return `Format "${format}" is not available for ${path}; use ${valid.join(', ')}`;
  return isDirectory
    ? `${path} has no export formats: the server offers directory archives (zip, tar) to insiders only`
    : `${path} has no export formats: PDF and DOCX need a Markdown document, or a file the watcher renders as Markdown (the watcher may be unreachable); svg and png need a Mermaid or PlantUML source`;
}

/**
 * The export URL of a page URL on an export route, keeping the page URL's
 * query (a share credential verifies on the export routes too) and dropping
 * the fragment. Only the pathname's leading `/browse/` is replaced; a page
 * URL served under a base path (`/base/browse/...`) is refused rather than
 * mangled.
 *
 * @param pageUrl - An absolute URL whose pathname starts `/browse/`.
 * @param route - The export route (`/api/<route>/`).
 * @param format - The format.
 * @returns The export URL, with `format` last.
 * @throws If the page URL's pathname doesn't start `/browse/`.
 */
export function exportUrlOf(
  pageUrl: string,
  route: string,
  format: string,
): string {
  const page = new URL(pageUrl);
  if (!page.pathname.startsWith(BROWSE))
    throw new Error(`Not a page URL: ${pageUrl}`);
  const url = new URL(route + page.pathname.slice(BROWSE.length), page.origin);
  url.search = `${page.search === '' ? '?' : `${page.search}&`}format=${encodeURIComponent(format)}`;
  return url.toString();
}
