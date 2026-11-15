/**
 * Deep share link rewriting for outsider access with depth traversal.
 *
 * Rewrites outgoing links in rendered HTML with computed sub-keys,
 * enabling outsiders to follow links up to N levels deep. A rewritten link
 * keeps its other query parameters (e.g. `download=1`, #316); only the
 * credential is added or replaced. The stack helpers are in
 * `deepShareStack.ts`.
 */

import * as cheerio from 'cheerio';

import {
  computeDeepShareKey,
  computePathKey,
  type DeepShareParams,
} from '../util/crypto.js';
import {
  deepShareQuery,
  pathKeyQuery,
  withCredentialQuery,
} from '../util/shareQuery.js';
import {
  type DeepShareContext,
  encodeStack,
  normalizeTargetPath,
  remainingDepth,
  stackWithCurrent,
} from './deepShareStack.js';

/** The share fields a sub-link carries over from the current request. */
type ShareFields = Omit<DeepShareContext, 'stackCompressed'>;

/**
 * Compute a sub-link URL for an outgoing link target.
 * Returns null if the link should be stripped (depth exhausted or type not allowed).
 *
 * @param suffix - The link's query and fragment as written (`?download=1#x`);
 *   its credential parameters are replaced, the rest kept.
 */
function computeSubLink(
  seed: string,
  targetUrlPath: string,
  currentStack: string[],
  share: ShareFields,
  isDirectory: boolean,
  suffix = '',
): string | null {
  const { maxDepth, dirs, exp } = share;
  // Check if directories are allowed
  if (isDirectory && !dirs) return null;

  // Revisiting truncates the stack to that point; a new page is appended.
  const existingIndex = currentStack.indexOf(targetUrlPath);
  const newStack =
    existingIndex >= 0
      ? currentStack.slice(0, existingIndex + 1)
      : [...currentStack, targetUrlPath];
  if (remainingDepth(maxDepth, newStack) < 0) return null;

  const params: DeepShareParams = {
    depth: maxDepth,
    dirs,
    stack: encodeStack(newStack),
    exp,
  };
  const key = computeDeepShareKey(seed, targetUrlPath, params);

  // The key covers the decoded path (what the access hook verifies); the URL
  // carries it percent-encoded.
  const encodedPath = targetUrlPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return withCredentialQuery(
    `/browse${encodedPath}${suffix}`,
    deepShareQuery(key, params),
  );
}

/**
 * Share URL for one entry of a directory listing reached via a deep link:
 * opening the entry is a step like following a link, so it is pushed onto
 * the stack and consumes depth; subdirectories need `dirs`. Returns null
 * when the entry may not be opened (depth exhausted or directory without
 * `dirs`): the listing shows it as plain text.
 */
export function computeEntryLink(
  seed: string,
  directoryPath: string,
  entryName: string,
  isDirectory: boolean,
  context: DeepShareContext,
): string | null {
  const stack = stackWithCurrent(context.stackCompressed, directoryPath);
  if (remainingDepth(context.maxDepth, stack) <= 0) return null;
  const target =
    directoryPath === '/' ? `/${entryName}` : `${directoryPath}/${entryName}`;
  return computeSubLink(seed, target, stack, context, isDirectory);
}

/** Hrefs left as written: external, protocol-relative, anchors, data, mail. */
const UNTOUCHED_HREF = /^(?:https?:|\/\/|#|data:|mailto:)/;

/**
 * The target path of an internal link (before normalisation) and its
 * query and fragment as written.
 */
function linkTarget(
  href: string,
  currentPath: string,
): { targetPath: string; suffix: string } {
  const suffixIndex = href.search(/[?#]/);
  const pathPart = suffixIndex >= 0 ? href.slice(0, suffixIndex) : href;
  const suffix = suffixIndex >= 0 ? href.slice(suffixIndex) : '';
  if (pathPart.startsWith('/browse/'))
    return { targetPath: pathPart.slice('/browse'.length), suffix };
  if (pathPart.startsWith('/')) return { targetPath: pathPart, suffix };
  // Relative link: resolve against the current path's directory.
  const dir = currentPath.substring(0, currentPath.lastIndexOf('/'));
  return { targetPath: `${dir}/${pathPart}`, suffix };
}

/**
 * Rewrite outgoing links in rendered HTML for deep share access.
 *
 * For outsiders with depth \> 0:
 * - Internal links get rewritten with sub-keys, keeping their other query
 *   parameters
 * - Links beyond depth get stripped (text preserved, link removed)
 * - External links (http/https) are left unchanged
 * - Anchor links (#) are left unchanged
 *
 * `isDirectoryPath` decides whether a target is a directory (the server
 * passes a filesystem stat). Without it, only a trailing slash marks a
 * directory; the directory route also refuses hops into directories
 * without `dirs`, so a misclassified link still can't list one.
 */
export function rewriteLinksForDeepShare(
  html: string,
  seed: string,
  currentPath: string,
  maxDepth: number,
  dirs: boolean,
  stackCompressed: string,
  exp: string | undefined,
  isDirectoryPath?: (urlPath: string) => boolean,
): string {
  const currentStack = stackWithCurrent(stackCompressed, currentPath);
  const remaining = remainingDepth(maxDepth, currentStack);
  const share: ShareFields = { maxDepth, dirs, exp };

  // The current page's deep params: what raw links and images carry.
  const pageParams: DeepShareParams = {
    depth: maxDepth,
    dirs,
    stack: stackCompressed,
    exp,
  };

  const $ = cheerio.load(html, null, false);
  const strip = ($el: ReturnType<typeof $>) => {
    $el.replaceWith($el.html() ?? '');
  };

  $('a').each((_i, el) => {
    const href = $(el).attr('href');
    if (!href || UNTOUCHED_HREF.test(href)) return;

    // If no remaining depth, strip the link (keep text)
    if (remaining <= 0) {
      strip($(el));
      return;
    }

    // Author-written raw links get the same deep-share auth as embedded
    // images (#269). Plain relative links are not turned into raw links.
    if (href.startsWith('/api/raw/')) {
      $(el).attr('href', authenticateRawUrl(href, seed, pageParams));
      return;
    }

    // Normalize (decode, resolve . and .., drop trailing slash); a target
    // that escapes the root is stripped.
    const { targetPath, suffix } = linkTarget(href, currentPath);
    const normalized = normalizeTargetPath(targetPath);
    if (normalized === null) {
      strip($(el));
      return;
    }

    const isDirectory = isDirectoryPath
      ? isDirectoryPath(normalized)
      : targetPath.endsWith('/');
    const subLink = computeSubLink(
      seed,
      normalized,
      currentStack,
      share,
      isDirectory,
      suffix,
    );
    if (subLink === null) strip($(el));
    else $(el).attr('href', subLink);
  });

  // Rewrite <img> src for images that use /api/raw/: add key auth
  rewriteImageAuth($, seed, pageParams);

  return $.html();
}

/**
 * Rewrite `<img>` src attributes in rendered HTML to include outsider auth.
 *
 * Works for both deep shares (with depth/stack params) and zero-depth outsider
 * shares (simple path keys). This is separated from link traversal so that
 * embedded images authenticate correctly for any outsider access.
 */
export function rewriteImageAuth(
  $: ReturnType<typeof cheerio.load>,
  seed: string,
  deepParams?: DeepShareParams,
): void {
  $('img').each((_i, el) => {
    const $el = $(el);
    const src = $el.attr('src');
    if (!src || !src.startsWith('/api/raw/')) return;

    $el.attr('src', authenticateRawUrl(src, seed, deepParams));
  });
}

/**
 * Give an `/api/raw/...` URL outsider auth: a deep share key over the
 * decoded content path with the share's deep params, or a simple path key
 * when there are none. The key travels as `k` (#279); a credential the URL
 * carries is replaced and its other parameters (e.g. `download`) kept.
 */
export function authenticateRawUrl(
  rawUrl: string,
  seed: string,
  deepParams?: DeepShareParams,
): string {
  const encodedPath = '/' + rawUrl.slice('/api/raw/'.length).split(/[?#]/)[0];
  let rawPath: string;
  try {
    rawPath = decodeURIComponent(encodedPath);
  } catch {
    rawPath = encodedPath;
  }
  const query = deepParams
    ? deepShareQuery(computeDeepShareKey(seed, rawPath, deepParams), deepParams)
    : pathKeyQuery(computePathKey(seed, rawPath));
  return withCredentialQuery(rawUrl, query);
}

/**
 * Convenience wrapper: load HTML, authenticate embedded images with simple
 * path keys (no deep share params), and return the updated HTML string.
 *
 * Route handlers can call this directly without importing cheerio.
 */
export function rewriteSimpleImageAuth(html: string, seed: string): string {
  const $ = cheerio.load(html, null, false);
  rewriteImageAuth($, seed);
  return $.html();
}
