/**
 * The one notion of "a Markdown document" (#284, #316): native `.md` and
 * `.markdown` files, and other text files jeeves-watcher renders as
 * Markdown (`renderAs: 'md'`, through the watcher SDK within the render
 * budget). The file API, export and link-info all load documents here, so
 * they agree on what is one.
 *
 * @packageDocumentation
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { WatcherUnavailable } from '../api/errors.js';
import { getConfig } from '../config/index.js';
import { DEFAULT_BRANDING } from '../config/schema.js';
import {
  looksLikeText,
  MARKDOWN_EXTS,
  PLANTUML_EXTS,
} from '../util/fileDetection.js';
import { type FrontMatter, parseFrontMatter } from './frontMatter.js';
import { renderViaWatcher } from './watcherRender.js';

/** Formats the file API renders itself: never sent to the watcher. */
const SELF_RENDERED_EXTS = new Set(['.mmd', ...PLANTUML_EXTS, '.svg', '.csv']);

/** A loaded Markdown document. */
export interface MarkdownDocument {
  /** `native` (a Markdown file) or `watcher` (rendered by jeeves-watcher). */
  origin: 'native' | 'watcher';
  /** The full Markdown text. */
  source: string;
  /** The parsed front matter. */
  frontMatter: FrontMatter;
  /** The Markdown after the front matter. */
  body: string;
  /** The `jeeves` front-matter mapping (Decision 2); `null` without one. */
  directives: Record<string, unknown> | null;
  /** Front-matter `title`, else the file name, else the brand name. */
  title: string;
  /** SHA-256 (hex) of `source`. */
  contentHash: string;
  /** Watcher documents: the watcher's `renderAs`. */
  renderAs?: string;
  /** Watcher documents: the watcher rules that matched. */
  matchedRules?: string[];
}

/** Options for {@link loadMarkdownDocument}. */
export interface LoadMarkdownOptions {
  /**
   * Throw `SERVER_WATCHER_UNAVAILABLE` when a file only the watcher could
   * render can't be, because the watcher is unreachable (export), instead
   * of answering `null` (file view, link-info).
   */
  requireWatcher?: boolean;
}

/** Files whose non-mapping `jeeves` value has been logged. */
const loggedIgnored = new Set<string>();

/**
 * Whether a path names a native Markdown file.
 *
 * @param fsPath - File system path.
 * @returns `true` for `.md` and `.markdown` (any case).
 */
export function isNativeMarkdown(fsPath: string): boolean {
  return MARKDOWN_EXTS.includes(path.extname(fsPath).toLowerCase());
}

/**
 * A document's title: a non-empty string front-matter `title`, else the
 * file name, else the brand name.
 *
 * @param data - Parsed front matter, if any.
 * @param fileName - The file's name.
 * @returns The title.
 */
export function documentTitle(
  data: Record<string, unknown> | null,
  fileName: string,
): string {
  const title = data?.title;
  if (typeof title === 'string' && title.trim() !== '') return title;
  return fileName || (getConfig().branding?.name ?? DEFAULT_BRANDING.name);
}

/**
 * The Markdown text of a file: its own text when native, else the
 * watcher's Markdown rendering of a text file.
 */
async function markdownSource(
  fsPath: string,
  requireWatcher: boolean,
): Promise<Pick<
  MarkdownDocument,
  'origin' | 'source' | 'renderAs' | 'matchedRules'
> | null> {
  if (isNativeMarkdown(fsPath))
    return { origin: 'native', source: fs.readFileSync(fsPath, 'utf8') };
  if (SELF_RENDERED_EXTS.has(path.extname(fsPath).toLowerCase())) return null;
  if (!looksLikeText(fs.readFileSync(fsPath))) return null;

  const rendered = await renderViaWatcher(fsPath);
  if (rendered.status === 'unreachable') {
    if (!requireWatcher) return null;
    throw Object.assign(new WatcherUnavailable('Watcher unreachable'), {
      cause: rendered.error,
    });
  }
  if (rendered.status !== 'rendered' || rendered.data.renderAs !== 'md')
    return null;
  return {
    origin: 'watcher',
    source: rendered.data.content,
    renderAs: rendered.data.renderAs,
    matchedRules: rendered.data.rules,
  };
}

/**
 * Load a file as a Markdown document.
 *
 * @param fsPath - An existing file's path.
 * @param options - See {@link LoadMarkdownOptions}.
 * @returns The document, or `null` when the file is not one.
 */
export async function loadMarkdownDocument(
  fsPath: string,
  options: LoadMarkdownOptions = {},
): Promise<MarkdownDocument | null> {
  const loaded = await markdownSource(fsPath, options.requireWatcher ?? false);
  if (!loaded) return null;

  const { frontMatter, body } = parseFrontMatter(loaded.source);
  if (frontMatter.jeevesIgnored && !loggedIgnored.has(fsPath)) {
    loggedIgnored.add(fsPath);
    console.debug(
      `Front matter "jeeves" is not a mapping, shown as data: ${fsPath}`,
    );
  }

  return {
    ...loaded,
    frontMatter,
    body,
    directives: frontMatter.directives,
    title: documentTitle(frontMatter.data, path.basename(fsPath)),
    contentHash: createHash('sha256').update(loaded.source).digest('hex'),
  };
}
