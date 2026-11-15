/**
 * Loads a configured print style (#316): reads its CSS and header/footer
 * templates from wherever config points (Decision 23), inlines assets and
 * fingerprints the result. Loads are cached per style by the
 * `(path, mtime, size)` of every file read and the style's config, so an
 * edited file or a config reload takes effect on the next export.
 *
 * @packageDocumentation
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';

import type {
  PrintPageConfig,
  PrintStyleConfig,
} from '@karmaniverous/jeeves-server-core';

import {
  type FileStamp,
  inlineAssets,
  type Inlined,
  stampOf,
} from './printStyleAssets.js';

/** Largest a style may be once its assets are inlined. */
export const MAX_PRINT_STYLE_BYTES = 5 * 1024 * 1024;

/** A print style ready to apply. */
export interface LoadedPrintStyle {
  /** Style name. */
  name: string;
  /** Hash of the name, CSS, templates and page options after inlining. */
  fingerprint: string;
  /** Stylesheet, assets inlined. */
  css: string;
  /** Header template, assets inlined. */
  headerTemplate?: string;
  /** Footer template, assets inlined. */
  footerTemplate?: string;
  /** Page options. */
  page?: PrintPageConfig;
}

interface CacheEntry {
  config: string;
  files: FileStamp[];
  style: LoadedPrintStyle;
}

const cache = new Map<string, CacheEntry>();

/** Whether every file an entry read is unchanged. */
function isFresh(entry: CacheEntry, config: string): boolean {
  if (entry.config !== config) return false;
  try {
    return entry.files.every((f) => {
      const now = stampOf(f.path);
      return now.mtimeMs === f.mtimeMs && now.size === f.size;
    });
  } catch {
    return false;
  }
}

/** Read one style file and inline its assets. */
function readInlined(
  file: string,
  kind: 'css' | 'html',
  config: PrintStyleConfig,
  warn: (message: string) => void,
): Inlined {
  const stamp = stampOf(file);
  const inlined = inlineAssets(
    fs.readFileSync(file, 'utf8'),
    kind,
    config.assets,
    warn,
  );
  return { text: inlined.text, read: [stamp, ...inlined.read] };
}

/**
 * Load a print style, from cache when none of its files changed.
 *
 * @param name - Style name.
 * @param config - The style's config.
 * @returns The loaded style.
 * @throws When a file can't be read or the style exceeds
 *   {@link MAX_PRINT_STYLE_BYTES} once inlined.
 */
export function loadPrintStyle(
  name: string,
  config: PrintStyleConfig,
): LoadedPrintStyle {
  const configJson = JSON.stringify(config);
  const hit = cache.get(name);
  if (hit && isFresh(hit, configJson)) return hit.style;

  const warn = (message: string): void => {
    console.warn(`Print style "${name}": removed ${message}`);
  };
  const css = readInlined(config.css, 'css', config, warn);
  const header =
    config.headerTemplate === undefined
      ? undefined
      : readInlined(config.headerTemplate, 'html', config, warn);
  const footer =
    config.footerTemplate === undefined
      ? undefined
      : readInlined(config.footerTemplate, 'html', config, warn);

  const parts = [css, header, footer].filter(
    (p): p is Inlined => p !== undefined,
  );
  const bytes = parts.reduce((n, p) => n + Buffer.byteLength(p.text), 0);
  if (bytes > MAX_PRINT_STYLE_BYTES)
    throw new Error(
      `inlined size ${String(bytes)} bytes exceeds ${String(MAX_PRINT_STYLE_BYTES)}`,
    );

  const content = {
    css: css.text,
    headerTemplate: header?.text,
    footerTemplate: footer?.text,
    page: config.page,
  };
  const style: LoadedPrintStyle = {
    name,
    fingerprint: createHash('sha256')
      .update(JSON.stringify({ name, ...content }))
      .digest('hex'),
    ...content,
  };
  cache.set(name, {
    config: configJson,
    files: parts.flatMap((p) => p.read),
    style,
  });
  return style;
}
