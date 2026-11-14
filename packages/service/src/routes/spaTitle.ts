/**
 * Page titles in the SPA shell (#262): for a `/browse/<path>` request that
 * passed the SPA gate, the path's title goes into `index.html`'s `<title>`
 * and `og:title`, so link unfurlers see the document title.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import path from 'node:path';

import { escapeHtml } from '../auth/pageShell.js';
import type { SpaAccess } from '../auth/resolve.js';
import { canAccessPath } from '../auth/scopeAccess.js';
import { DEFAULT_BRANDING } from '../config/schema.js';
import type { RuntimeConfig } from '../config/types.js';
import { pathTitle } from '../services/pathTitle.js';
import { getRoots, urlPathToFs } from '../util/platform.js';

/**
 * The browse path a page URL addresses.
 *
 * @param url - The request URL.
 * @returns The decoded path with a leading slash, or `null` when the URL
 * names no path under `/browse/`, is malformed or climbs (`.`, `..`, `\`).
 */
export function browsePathOf(url: string): string | null {
  const pathname = url.split('?')[0];
  if (!pathname.startsWith('/browse/')) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname.slice('/browse'.length));
  } catch {
    return null;
  }
  const segments = decoded.split('/').filter(Boolean);
  if (
    segments.length === 0 ||
    decoded.includes('\\') ||
    segments.some((s) => s === '.' || s === '..')
  )
    return null;
  return '/' + segments.join('/');
}

/**
 * The title of the path a gated page request addresses.
 *
 * @param url - The request URL.
 * @param access - The SPA gate's answer (it passed).
 * @param config - Current runtime configuration.
 * @returns The title, or `null` when the path is missing, unresolvable or
 * outside the caller's scopes.
 */
export async function spaPageTitle(
  url: string,
  access: SpaAccess,
  config: RuntimeConfig,
): Promise<string | null> {
  const urlPath = browsePathOf(url);
  if (!urlPath || !canAccessPath(urlPath, access.scopes)) return null;
  const roots = getRoots(config.roots);
  const fsPath = urlPathToFs(urlPath, roots);
  if (!fsPath) return null;
  const resolved = path.resolve(fsPath);
  if (!fs.existsSync(resolved)) return null;
  return pathTitle(resolved, roots);
}

/**
 * Put a title into an HTML shell: `<title>{title} - {brand}</title>` and
 * `<meta property="og:title" content="{title}">`, both HTML-escaped.
 *
 * @param html - The shell (`index.html`).
 * @param title - The page's title.
 * @param brand - The brand name (`branding.name`).
 * @returns The shell with the title.
 */
export function injectPageTitle(
  html: string,
  title: string,
  brand: string = DEFAULT_BRANDING.name,
): string {
  const tags =
    `<title>${escapeHtml(`${title} - ${brand}`)}</title>` +
    `<meta property="og:title" content="${escapeHtml(title)}" />`;
  return /<title>[\s\S]*?<\/title>/.test(html)
    ? html.replace(/<title>[\s\S]*?<\/title>/, () => tags)
    : html.replace(/<\/head>/i, () => `${tags}</head>`);
}
