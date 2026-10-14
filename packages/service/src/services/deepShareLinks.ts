/**
 * Deep share link rewriting for outsider access with depth traversal.
 *
 * Rewrites outgoing links in rendered HTML with computed sub-keys,
 * enabling outsiders to follow links up to N levels deep.
 */

import * as cheerio from 'cheerio';
import LZString from 'lz-string';

import {
  computeDeepShareKey,
  computePathKey,
  type DeepShareParams,
} from '../util/crypto.js';

/**
 * Parse a compressed stack string into an array of paths.
 */
export function decodeStack(compressed: string): string[] {
  if (!compressed) return [];
  const json = LZString.decompressFromEncodedURIComponent(compressed);
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Encode a path stack array into a compressed string.
 */
export function encodeStack(stack: string[]): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(stack));
}

/**
 * Compute the remaining depth for a given stack.
 */
function remainingDepth(maxDepth: number, stack: string[]): number {
  return maxDepth - (stack.length - 1);
}

/**
 * Compute a sub-link URL for an outgoing link target.
 * Returns null if the link should be stripped (depth exhausted or type not allowed).
 */
function computeSubLink(
  seed: string,
  targetUrlPath: string,
  currentStack: string[],
  maxDepth: number,
  dirs: boolean,
  exp: string | undefined,
  isDirectory: boolean,
  fragment?: string,
): string | null {
  // Check if directories are allowed
  if (isDirectory && !dirs) return null;

  // Compute new stack
  const existingIndex = currentStack.indexOf(targetUrlPath);
  let newStack: string[];
  if (existingIndex >= 0) {
    // Revisiting — truncate stack to that point
    newStack = currentStack.slice(0, existingIndex + 1);
  } else {
    // New page — append
    newStack = [...currentStack, targetUrlPath];
  }

  // Check remaining depth
  const remaining = remainingDepth(maxDepth, newStack);
  if (remaining < 0) return null;

  const compressedStack = encodeStack(newStack);

  // Compute key for the target
  const params: DeepShareParams = {
    depth: maxDepth,
    dirs,
    stack: compressedStack,
    exp,
  };
  const key = computeDeepShareKey(seed, targetUrlPath, params);

  // Build URL
  // The key covers the decoded path (what the middleware verifies); the URL
  // carries it percent-encoded.
  const encodedPath = targetUrlPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  let url = `/browse${encodedPath}?k=${key}&d=${String(maxDepth)}&dirs=${dirs ? '1' : '0'}&s=${compressedStack}`;
  if (exp) url += `&exp=${exp}`;
  if (fragment !== undefined) url += `#${fragment}`;
  return url;
}

/** Deep share parameters of the current request, as received. */
export interface DeepShareContext {
  maxDepth: number;
  dirs: boolean;
  stackCompressed: string;
  exp: string | undefined;
}

/** Decode the stack and make sure the current path is its last entry. */
function stackWithCurrent(stackCompressed: string, currentPath: string) {
  const stack = decodeStack(stackCompressed);
  if (stack.length === 0 || stack[stack.length - 1] !== currentPath) {
    stack.push(currentPath);
  }
  return stack;
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
  return computeSubLink(
    seed,
    target,
    stack,
    context.maxDepth,
    context.dirs,
    context.exp,
    isDirectory,
  );
}

/**
 * Normalize a link target to a content URL path: percent-decoded, `.` and
 * `..` resolved, duplicate and trailing slashes removed. Returns null when
 * the target escapes the root or can't be decoded.
 */
export function normalizeTargetPath(target: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    return null;
  }
  const out: string[] = [];
  for (const segment of decoded.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (out.length === 0) return null;
      out.pop();
      continue;
    }
    out.push(segment);
  }
  return out.length > 0 ? `/${out.join('/')}` : null;
}

/**
 * Rewrite outgoing links in rendered HTML for deep share access.
 *
 * For outsiders with depth \> 0:
 * - Internal links get rewritten with sub-keys
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

  const $ = cheerio.load(html, null, false);

  // Rewrite <a> tags
  $('a').each((_i, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    if (!href) return;

    // Skip external links, anchors, and data URLs
    if (
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('#') ||
      href.startsWith('//') ||
      href.startsWith('data:') ||
      href.startsWith('mailto:')
    ) {
      return;
    }

    // If no remaining depth, strip the link (keep text)
    if (remaining <= 0) {
      $el.replaceWith($el.html() ?? '');
      return;
    }

    // Author-written raw links get the same deep-share auth as embedded
    // images (#269). Plain relative links are not turned into raw links.
    if (href.startsWith('/api/raw/')) {
      $el.attr(
        'href',
        authenticateRawUrl(href, seed, {
          depth: maxDepth,
          dirs,
          stack: stackCompressed,
          exp,
        }),
      );
      return;
    }

    // Strip fragment before resolving path, preserve it for later
    const hashIndex = href.indexOf('#');
    const hrefWithoutFragment =
      hashIndex >= 0 ? href.substring(0, hashIndex) : href;
    const fragment = hashIndex >= 0 ? href.substring(hashIndex + 1) : undefined;

    // Determine target path
    let targetPath: string;
    if (hrefWithoutFragment.startsWith('/browse/')) {
      targetPath =
        '/' + hrefWithoutFragment.replace('/browse/', '').split('?')[0];
    } else if (hrefWithoutFragment.startsWith('/')) {
      targetPath = hrefWithoutFragment.split('?')[0];
    } else {
      // Relative link — resolve against current path directory
      const dir = currentPath.substring(0, currentPath.lastIndexOf('/'));
      targetPath = dir
        ? `${dir}/${hrefWithoutFragment.split('?')[0]}`
        : `/${hrefWithoutFragment.split('?')[0]}`;
    }

    // Normalize (decode, resolve . and .., drop trailing slash); a target
    // that escapes the root is stripped.
    const hadTrailingSlash = targetPath.endsWith('/');
    const normalized = normalizeTargetPath(targetPath);
    if (normalized === null) {
      $el.replaceWith($el.html() ?? '');
      return;
    }

    const isDirectory = isDirectoryPath
      ? isDirectoryPath(normalized)
      : hadTrailingSlash;
    const subLink = computeSubLink(
      seed,
      normalized,
      currentStack,
      maxDepth,
      dirs,
      exp,
      isDirectory,
      fragment,
    );

    if (subLink === null) {
      // Strip link, keep text
      $el.replaceWith($el.html() ?? '');
    } else {
      $el.attr('href', subLink);
    }
  });

  // Rewrite <img> src for images that use /api/raw/ — add key auth
  rewriteImageAuth($, seed, {
    depth: maxDepth,
    dirs,
    stack: stackCompressed,
    exp,
  });

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
 * Append outsider auth to an `/api/raw/...` URL: a deep share key over the
 * decoded content path with the share's deep params, or a simple path key
 * when there are none. The key travels as `k` (#279).
 */
export function authenticateRawUrl(
  rawUrl: string,
  seed: string,
  deepParams?: DeepShareParams,
): string {
  const hashIndex = rawUrl.indexOf('#');
  const base = hashIndex >= 0 ? rawUrl.slice(0, hashIndex) : rawUrl;
  const fragment = hashIndex >= 0 ? rawUrl.slice(hashIndex) : '';
  const encodedPath = '/' + base.slice('/api/raw/'.length).split('?')[0];
  let rawPath: string;
  try {
    rawPath = decodeURIComponent(encodedPath);
  } catch {
    rawPath = encodedPath;
  }
  const sep = base.includes('?') ? '&' : '?';

  if (!deepParams) {
    return `${base}${sep}k=${computePathKey(seed, rawPath)}${fragment}`;
  }
  const key = computeDeepShareKey(seed, rawPath, deepParams);
  const params = [
    `k=${key}`,
    `d=${String(deepParams.depth)}`,
    `dirs=${deepParams.dirs ? '1' : '0'}`,
    `s=${deepParams.stack}`,
    ...(deepParams.exp ? [`exp=${deepParams.exp}`] : []),
  ];
  return `${base}${sep}${params.join('&')}${fragment}`;
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
