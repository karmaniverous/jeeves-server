/**
 * Link helpers: add a share credential to a URL, and derive the raw-content and export URLs of a `/browse/` page URL (the one place that maps `/browse/` to `/api/raw/` and the export routes). Pure, no I/O.
 *
 * @packageDocumentation
 */

import { type ShareCredential, shareParams } from './auth.js';
import { appendQuery, splitUrl } from './query.js';
import { invalidOptions } from './ServerError.js';

/**
 * Formats {@link toExportUrl} derives URLs for: `pdf`/`docx` for Markdown
 * documents and `zip`/`tar` for directories (`/api/export/`), `svg`/`png`/`pdf`
 * for Mermaid sources (`.mmd`, `/api/mermaid-export/`) and `svg`/`png` (plus
 * `pdf` when the server has a PlantUML jar) for PlantUML sources (`.puml`,
 * `.plantuml`, `/api/plantuml-export/`).
 */
export type ExportFormat = 'pdf' | 'docx' | 'zip' | 'tar' | 'svg' | 'png';

/** Options of {@link toExportUrl}. */
export interface ExportUrlOptions {
  /**
   * The export route to build the URL on, as an `/api/<route>/` prefix:
   * lowercase letters and hyphens between `/api/` and the closing `/` (an
   * export route such as `/api/export/`, `/api/mermaid-export/` or
   * `/api/plantuml-export/`: the start of a link-info export link's `url`).
   * Only the form is checked, not a list of known routes. When given, the URL is
   * built on this route and the format is not checked against the file
   * extension: link-info already says which formats a path offers, and where.
   */
  route?: string;
}

/** The prefix of a page URL's path. */
const PAGE_PREFIX = '/browse/';

/** The form of an export route. */
const EXPORT_ROUTE = /^\/api\/[a-z-]+\/$/;

/** An export route and the formats it serves for a kind of path. */
interface ExportTarget {
  route: string;
  formats: readonly ExportFormat[];
}

/** Mermaid sources. */
const MERMAID: ExportTarget = {
  route: '/api/mermaid-export/',
  formats: ['svg', 'png', 'pdf'],
};

/**
 * PlantUML sources. PDF needs a PlantUML jar on the server: pass link-info's
 * route to {@link toExportUrl} for it.
 */
const PLANTUML: ExportTarget = {
  route: '/api/plantuml-export/',
  formats: ['svg', 'png'],
};

/** Markdown documents and directories (every other path). */
const DOCUMENT: ExportTarget = {
  route: '/api/export/',
  formats: ['pdf', 'docx', 'zip', 'tar'],
};

/** Diagram export target by source file extension. */
const DIAGRAM_TARGETS: ReadonlyMap<string, ExportTarget> = new Map([
  ['.mmd', MERMAID],
  ['.puml', PLANTUML],
  ['.plantuml', PLANTUML],
]);

/**
 * Add a share credential's parameters to a URL. Parameters the URL already
 * carries (e.g. `download`, or a key) are kept as they are; the fragment
 * stays last.
 *
 * @param url - Any URL, absolute or root-relative.
 * @param share - The share credential.
 * @returns The URL with the credential.
 */
export function withShareCredential(
  url: string,
  share: ShareCredential,
): string {
  return appendQuery(url, shareParams(share));
}

/**
 * The parts of a page URL.
 *
 * @param pageUrl - A `/browse/<path>` URL, absolute or root-relative.
 * @returns Origin, browse path (after `/browse/`) and query, as written.
 * @throws {@link ServerError} `invalid_options` when the path does not start
 *   with `/browse/`.
 */
function pageParts(pageUrl: string) {
  const { base, path, query } = splitUrl(pageUrl);
  if (!path.startsWith(PAGE_PREFIX) || path.length === PAGE_PREFIX.length)
    throw invalidOptions('pageUrl must address a /browse/<path> page');
  return {
    origin: base.slice(0, base.length - path.length),
    browsePath: path.slice(PAGE_PREFIX.length),
    query,
  };
}

/**
 * The raw-content URL of a page URL: `/browse/<path>` becomes
 * `/api/raw/<path>`, keeping the query (a share credential verifies on both)
 * and dropping the fragment.
 *
 * @param pageUrl - A `/browse/<path>` URL, absolute or root-relative.
 * @returns The `/api/raw/<path>` URL.
 * @throws {@link ServerError} `invalid_options` for a URL that isn't a page URL.
 */
export function toRawUrl(pageUrl: string): string {
  const { origin, browsePath, query } = pageParts(pageUrl);
  return `${origin}/api/raw/${browsePath}${query}`;
}

/**
 * The export route of a browse path in a format, from its file extension.
 *
 * @param browsePath - The path after `/browse/`.
 * @param format - The format.
 * @returns The route.
 * @throws {@link ServerError} `invalid_options` for a format the path can't
 *   be exported in (the message names the valid ones).
 */
function routeByExtension(browsePath: string, format: ExportFormat): string {
  const name = browsePath.slice(browsePath.lastIndexOf('/') + 1);
  const extension = name.includes('.')
    ? name.slice(name.lastIndexOf('.')).toLowerCase()
    : '';
  const { route, formats } = DIAGRAM_TARGETS.get(extension) ?? DOCUMENT;
  if (!formats.includes(format))
    throw invalidOptions(
      `Format "${format}" is not available for ${name}; use ${formats.join(', ')}`,
    );
  return route;
}

/**
 * The export URL of a page URL in a format, keeping the query (a share
 * credential verifies on the export routes too) and dropping the fragment.
 *
 * With `options.route` (the `/api/<route>/` prefix of a link-info export
 * link) the URL is built on that route and the format isn't checked: the
 * server's link-info is the source of truth for which formats a path offers.
 * Without it, the route and the valid formats come from the file extension:
 * `svg`/`png`/`pdf` of a Mermaid source address `/api/mermaid-export/`;
 * `svg`/`png` of a PlantUML source address `/api/plantuml-export/`;
 * `pdf`/`docx` (Markdown) and `zip`/`tar` (directories) address
 * `/api/export/`.
 *
 * @param pageUrl - A `/browse/<path>` URL, absolute or root-relative.
 * @param format - The format.
 * @param options - The export route, when known.
 * @returns The export URL, with `format`.
 * @throws {@link ServerError} `invalid_options` for a URL that isn't a page
 *   URL, a `route` that isn't an `/api/<route>/` prefix, or (without `route`)
 *   a format the path can't be exported in (the message names the valid
 *   ones).
 */
export function toExportUrl(
  pageUrl: string,
  format: ExportFormat,
  options: ExportUrlOptions = {},
): string {
  const { origin, browsePath, query } = pageParts(pageUrl);
  const { route } = options;
  if (route !== undefined && !EXPORT_ROUTE.test(route))
    throw invalidOptions(
      `route must be an /api/<route>/ prefix such as /api/export/; got "${route}"`,
    );
  const target = route ?? routeByExtension(browsePath, format);
  return appendQuery(`${origin}${target}${browsePath}${query}`, [
    ['format', format],
  ]);
}
