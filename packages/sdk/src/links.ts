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
 * documents and `zip`/`tar` for directories (`/api/export/`), `svg`/`png`
 * for Mermaid (`.mmd`, `/api/mermaid-export/`) and PlantUML (`.puml`,
 * `.plantuml`, `/api/plantuml-export/`) sources.
 */
export type ExportFormat = 'pdf' | 'docx' | 'zip' | 'tar' | 'svg' | 'png';

/** The prefix of a page URL's path. */
const PAGE_PREFIX = '/browse/';

/** Diagram export route by source file extension. */
const DIAGRAM_ROUTES: ReadonlyMap<string, string> = new Map([
  ['.mmd', '/api/mermaid-export/'],
  ['.puml', '/api/plantuml-export/'],
  ['.plantuml', '/api/plantuml-export/'],
]);

/** Formats of each kind of export. */
const DIAGRAM_FORMATS: readonly ExportFormat[] = ['svg', 'png'];
const DOCUMENT_FORMATS: readonly ExportFormat[] = ['pdf', 'docx', 'zip', 'tar'];

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
 * The export URL of a page URL in a format, keeping the query (a share
 * credential verifies on the export routes too) and dropping the fragment:
 * `svg`/`png` of a Mermaid or PlantUML source address its diagram export
 * route; `pdf`/`docx` (Markdown) and `zip`/`tar` (directories) address
 * `/api/export/`.
 *
 * @param pageUrl - A `/browse/<path>` URL, absolute or root-relative.
 * @param format - The format.
 * @returns The export URL, with `format`.
 * @throws {@link ServerError} `invalid_options` for a URL that isn't a page
 *   URL, or a format the path can't be exported in (the message names the
 *   valid ones).
 */
export function toExportUrl(pageUrl: string, format: ExportFormat): string {
  const { origin, browsePath, query } = pageParts(pageUrl);
  const name = browsePath.slice(browsePath.lastIndexOf('/') + 1);
  const extension = name.includes('.')
    ? name.slice(name.lastIndexOf('.')).toLowerCase()
    : '';
  const diagramRoute = DIAGRAM_ROUTES.get(extension);
  const valid = diagramRoute === undefined ? DOCUMENT_FORMATS : DIAGRAM_FORMATS;
  if (!valid.includes(format))
    throw invalidOptions(
      `Format "${format}" is not available for ${name}; use ${valid.join(', ')}`,
    );
  const route = diagramRoute ?? '/api/export/';
  return appendQuery(`${origin}${route}${browsePath}${query}`, [
    ['format', format],
  ]);
}
