/**
 * Fingerprint of the local images a Markdown document references, for the
 * export cache key (#288): editing, adding or removing a referenced image
 * changes it.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import path from 'node:path';

import * as cheerio from 'cheerio';
import MarkdownIt, { type Token } from 'markdown-it';

import { type RootEntry, urlPathToFs } from '../util/platform.js';

const md = new MarkdownIt({ html: true });

/** Image sources in a token stream: Markdown images and HTML `<img>`. */
function imageSources(tokens: Token[]): string[] {
  const sources: string[] = [];
  for (const token of tokens) {
    if (token.type === 'image')
      sources.push(String(token.attrGet('src') ?? ''));
    if (token.type === 'html_inline' || token.type === 'html_block') {
      const $ = cheerio.load(token.content);
      $('img[src]').each((_, el) => {
        sources.push($(el).attr('src') ?? '');
      });
    }
    if (token.children) sources.push(...imageSources(token.children));
  }
  return sources;
}

/**
 * The file an image source names, as the rendered page would fetch it: a
 * relative source beside the document, `/path/…` and `/api/raw/…` under
 * the roots. Remote, data and other sources are not local images.
 */
function localImagePath(
  src: string,
  docDir: string,
  roots: RootEntry[],
): string | null {
  const bare = src.split(/[?#]/)[0];
  if (!bare || /^[a-z][a-z\d+.-]*:/i.test(bare) || bare.startsWith('//'))
    return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(bare);
  } catch {
    decoded = bare;
  }
  if (!decoded.startsWith('/')) return path.resolve(docDir, decoded);
  const urlPath = /^\/(?:path|api\/raw)\/(.+)$/.exec(decoded)?.[1];
  const fsPath = urlPath ? urlPathToFs(urlPath, roots) : null;
  return fsPath ? path.resolve(fsPath) : null;
}

/**
 * The local image files a document references, resolved and sorted.
 *
 * @param source - The document's Markdown.
 * @param fsPath - The document's path (relative sources resolve beside it).
 * @param roots - Configured roots (for `/path/…` and `/api/raw/…`).
 * @returns Unique resolved paths.
 */
export function localImagePaths(
  source: string,
  fsPath: string,
  roots: RootEntry[],
): string[] {
  const docDir = path.dirname(fsPath);
  const paths = new Set<string>();
  for (const src of imageSources(md.parse(source, {}))) {
    const resolved = localImagePath(src, docDir, roots);
    if (resolved) paths.add(resolved);
  }
  return [...paths].sort();
}

/**
 * Fingerprint the local images a document references: each resolved path
 * with its mtime and size (`missing` when absent), sorted.
 *
 * @param source - The document's Markdown.
 * @param fsPath - The document's path.
 * @param roots - Configured roots.
 * @returns A string that changes when any referenced image does.
 */
export function imageFingerprint(
  source: string,
  fsPath: string,
  roots: RootEntry[],
): string {
  return localImagePaths(source, fsPath, roots)
    .map((file) => {
      try {
        const stat = fs.statSync(file);
        return `${file}\0${String(stat.mtimeMs)}\0${String(stat.size)}`;
      } catch {
        return `${file}\0missing`;
      }
    })
    .join('\n');
}
