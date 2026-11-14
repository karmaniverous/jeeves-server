/**
 * The deep share stack: the compressed list of paths a deep link has
 * followed, the depth it has left, the request's deep share context, and
 * link target normalisation. Pure.
 *
 * @packageDocumentation
 */

import LZString from 'lz-string';

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

/** Decode the stack and make sure the current path is its last entry. */
export function stackWithCurrent(
  stackCompressed: string,
  currentPath: string,
): string[] {
  const stack = decodeStack(stackCompressed);
  if (stack.length === 0 || stack[stack.length - 1] !== currentPath) {
    stack.push(currentPath);
  }
  return stack;
}

/** Deep share parameters of the current request, as received. */
export interface DeepShareContext {
  maxDepth: number;
  dirs: boolean;
  stackCompressed: string;
  exp: string | undefined;
}

/**
 * Deep share context from the verified request params (`d`, `dirs`, `s`)
 * and the query's `exp`. A missing or non-numeric depth counts as 0.
 */
export function toDeepShareContext(
  params: { d: string; dirs: string; s: string },
  exp: string | undefined,
): DeepShareContext {
  return {
    maxDepth: Number.parseInt(params.d, 10) || 0,
    dirs: params.dirs === '1',
    stackCompressed: params.s,
    exp,
  };
}

/**
 * Whether a deep link may list `directoryPath`. With `dirs`, any directory
 * it reaches; without, only the shared path itself (a one-entry stack).
 */
export function canListDirectory(
  context: DeepShareContext,
  directoryPath: string,
): boolean {
  if (context.dirs) return true;
  const stack = decodeStack(context.stackCompressed);
  const sharedRoot = stack.length === 1 ? stack[0] : undefined;
  return sharedRoot?.toLowerCase() === directoryPath.toLowerCase();
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
