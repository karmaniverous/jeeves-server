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

/**
 * The `/api/<route>/` prefix of a server-relative export URL, in the form
 * the SDK's `toExportUrl` takes as its `route` option.
 */
const ROUTE = /^\/api\/[a-z-]+\//;

/**
 * Whether a format is one the tool's `format` parameter accepts.
 *
 * @param format - Any format.
 * @returns Whether it is one of {@link EXPORT_FORMATS}.
 */
const isExportFormat = (format: string): format is ExportFormat =>
  (EXPORT_FORMATS as readonly string[]).includes(format);

/** A format the tool accepts, and the route link-info offers it on. */
interface ExportTarget {
  /** The format. */
  format: ExportFormat;
  /** Its `/api/<route>/` prefix. */
  route: string;
}

/**
 * The route a path offers a format on.
 *
 * @param routes - The path's routes by format ({@link exportRoutesOf}).
 * @param format - Any format.
 * @returns The format and its route; none when the path doesn't offer it
 *   (or the tool doesn't accept it).
 */
export function routeFor(
  routes: ReadonlyMap<ExportFormat, string>,
  format: string,
): ExportTarget | undefined {
  if (!isExportFormat(format)) return undefined;
  const route = routes.get(format);
  return route === undefined ? undefined : { format, route };
}

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
): ReadonlyMap<ExportFormat, string> {
  const routes = new Map<ExportFormat, string>();
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
