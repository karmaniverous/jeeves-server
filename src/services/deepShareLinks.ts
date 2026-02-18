/**
 * Deep share link rewriting for outsider access with depth traversal.
 *
 * Rewrites outgoing links in rendered HTML with computed sub-keys,
 * enabling outsiders to follow links up to N levels deep.
 */

import * as cheerio from 'cheerio';
import LZString from 'lz-string';

import { computeDeepShareKey, type DeepShareParams } from '../util/crypto.js';

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
export function remainingDepth(maxDepth: number, stack: string[]): number {
  return maxDepth - (stack.length - 1);
}

/**
 * Compute a sub-link URL for an outgoing link target.
 * Returns null if the link should be stripped (depth exhausted or type not allowed).
 */
export function computeSubLink(
  seed: string,
  targetUrlPath: string,
  currentStack: string[],
  maxDepth: number,
  dirs: boolean,
  exp: string | undefined,
  isDirectory: boolean,
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
  let url = `/browse${targetUrlPath}?key=${key}&d=${String(maxDepth)}&dirs=${dirs ? '1' : '0'}&s=${compressedStack}`;
  if (exp) url += `&exp=${exp}`;
  return url;
}

/**
 * Rewrite outgoing links in rendered HTML for deep share access.
 *
 * For outsiders with depth > 0:
 * - Internal links get rewritten with sub-keys
 * - Links beyond depth get stripped (text preserved, link removed)
 * - External links (http/https) are left unchanged
 * - Anchor links (#) are left unchanged
 */
export function rewriteLinksForDeepShare(
  html: string,
  seed: string,
  currentPath: string,
  maxDepth: number,
  dirs: boolean,
  stackCompressed: string,
  exp: string | undefined,
): string {
  const currentStack = decodeStack(stackCompressed);
  // Ensure current path is in the stack
  if (currentStack.length === 0 || currentStack[currentStack.length - 1] !== currentPath) {
    currentStack.push(currentPath);
  }

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

    // Raw file links — leave as-is (these are for images/downloads)
    if (href.startsWith('/api/raw/')) return;

    // Determine target path
    let targetPath: string;
    if (href.startsWith('/browse/')) {
      targetPath = '/' + href.replace('/browse/', '').split('?')[0];
    } else if (href.startsWith('/')) {
      targetPath = href.split('?')[0];
    } else {
      // Relative link — resolve against current path directory
      const dir = currentPath.substring(0, currentPath.lastIndexOf('/'));
      targetPath = dir ? `${dir}/${href.split('?')[0]}` : `/${href.split('?')[0]}`;
    }

    // Normalize
    targetPath = targetPath.replace(/\/+/g, '/');

    const isDirectory = targetPath.endsWith('/');
    const subLink = computeSubLink(
      seed,
      targetPath,
      currentStack,
      maxDepth,
      dirs,
      exp,
      isDirectory,
    );

    if (subLink === null) {
      // Strip link, keep text
      $el.replaceWith($el.html() ?? '');
    } else {
      $el.attr('href', subLink);
    }
  });

  // Rewrite <img> src for images that use /api/raw/ — add key auth
  $('img').each((_i, el) => {
    const $el = $(el);
    const src = $el.attr('src');
    if (!src || !src.startsWith('/api/raw/')) return;

    const params: DeepShareParams = {
      depth: maxDepth,
      dirs,
      stack: stackCompressed,
      exp,
    };
    const rawPath = '/' + src.replace('/api/raw/', '').split('?')[0];
    const key = computeDeepShareKey(seed, rawPath, params);
    const authSrc = `${src}${src.includes('?') ? '&' : '?'}key=${key}&d=${String(maxDepth)}&dirs=${dirs ? '1' : '0'}&s=${stackCompressed}${exp ? `&exp=${exp}` : ''}`;
    $el.attr('src', authSrc);
  });

  return $.html();
}
