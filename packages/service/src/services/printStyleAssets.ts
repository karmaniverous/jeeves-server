/**
 * Inlines a print style's assets (#316): every `url(...)` in its CSS and
 * every `src="..."` in its header/footer templates that resolves to a file
 * inside the style's `assets` directory becomes a `data:` URI; anything
 * outside the directory, missing or remote is removed and logged. Reads
 * asset files; returns the files it read so the caller can watch them.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import path from 'node:path';

import { getContentType } from '../util/fileDetection.js';

/** A file an inlined text depends on, as last read. */
export interface FileStamp {
  /** Absolute path. */
  path: string;
  /** Modification time (ms). */
  mtimeMs: number;
  /** Size in bytes. */
  size: number;
}

/**
 * Stat a file.
 *
 * @param file - Path.
 * @returns Its stamp (throws when it can't be read).
 */
export function stampOf(file: string): FileStamp {
  const stats = fs.statSync(file);
  return { path: file, mtimeMs: stats.mtimeMs, size: stats.size };
}

/** CSS `url(...)` with an optional quoted argument. */
const CSS_URL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"]*?))\s*\)/gi;

/** HTML `src` attribute, double or single quoted. */
const HTML_SRC = /\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

/** References left as they are: data URIs and in-document fragments. */
const KEEP = /^(?:data:|#)/i;

/** References that are remote or otherwise not a local file. */
const REMOTE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/** Percent-decode a URL path, leaving a malformed one as it is. */
function decodePath(ref: string): string {
  try {
    return decodeURI(ref);
  } catch {
    return ref;
  }
}

/**
 * Resolve one reference to a data URI, or `null` when it must be removed.
 */
function inlineRef(
  ref: string,
  assetsDir: string | undefined,
  read: FileStamp[],
  warn: (message: string) => void,
): string | null {
  if (REMOTE.test(ref) || !assetsDir) {
    warn(`not a file in the assets directory: ${ref}`);
    return null;
  }
  const file = path.resolve(assetsDir, decodePath(ref.split(/[?#]/)[0]));
  const rel = path.relative(assetsDir, file);
  // `..` itself or a `..` first segment; `..logo.png` is inside.
  const outside = rel === '..' || rel.startsWith(`..${path.sep}`);
  if (!rel || outside || path.isAbsolute(rel)) {
    warn(`outside the assets directory: ${ref}`);
    return null;
  }
  try {
    const stamp = stampOf(file);
    const bytes = fs.readFileSync(file);
    read.push(stamp);
    const type = getContentType(path.extname(file)).split(';')[0];
    return `data:${type};base64,${bytes.toString('base64')}`;
  } catch {
    warn(`asset not readable: ${ref}`);
    return null;
  }
}

/** The result of inlining a text. */
export interface Inlined {
  /** The text with references inlined or removed. */
  text: string;
  /** The asset files read. */
  read: FileStamp[];
}

/**
 * Inline the assets of a stylesheet or template.
 *
 * @param text - CSS or template HTML.
 * @param kind - `css` (rewrites `url(...)`) or `html` (rewrites `src`).
 * @param assetsDir - The style's assets directory, if configured.
 * @param warn - Logs a removed reference.
 * @returns The rewritten text and the files read.
 */
export function inlineAssets(
  text: string,
  kind: 'css' | 'html',
  assetsDir: string | undefined,
  warn: (message: string) => void,
): Inlined {
  const read: FileStamp[] = [];
  const resolve = (ref: string): string | null =>
    inlineRef(ref, assetsDir, read, warn);

  const out =
    kind === 'css'
      ? text.replace(
          CSS_URL,
          (match, dq?: string, sq?: string, bare?: string) => {
            const ref = (dq ?? sq ?? bare ?? '').trim();
            if (KEEP.test(ref)) return match;
            const uri = resolve(ref);
            return uri === null ? 'none' : `url("${uri}")`;
          },
        )
      : text.replace(HTML_SRC, (match, dq?: string, sq?: string) => {
          const ref = (dq ?? sq ?? '').trim();
          if (KEEP.test(ref)) return match;
          const uri = resolve(ref);
          return uri === null ? '' : ` src="${uri}"`;
        });
  return { text: out, read };
}
