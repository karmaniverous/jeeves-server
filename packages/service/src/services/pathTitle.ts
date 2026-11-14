/**
 * The title of a browse path (#262): a Markdown document's title from the
 * document loader, a directory's or other file's name, and a drive root's
 * label. The SPA fallback puts it in the page's `<title>` and `og:title`.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import path from 'node:path';

import type { RootEntry } from '../util/platform.js';
import { loadMarkdownDocument } from './markdownDocument.js';

/** How long the SPA fallback waits for a document's title (1.5 s). */
export const TITLE_BUDGET_MS = 1500;

/**
 * Resolve within `ms`, else with `fallback` (the work is left to finish).
 *
 * @param work - The work.
 * @param ms - The budget.
 * @param fallback - The answer when the budget runs out or the work fails.
 * @returns The work's answer or the fallback.
 */
async function withinBudget<T>(
  work: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      resolve(fallback);
    }, ms);
    timer.unref();
  });
  try {
    return await Promise.race([work.catch(() => fallback), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The title of an existing path.
 *
 * @param fsPath - Resolved file system path (it must exist).
 * @param roots - The configured roots (a root's title is its label).
 * @param budgetMs - How long to wait for a document's title.
 * @returns The title.
 */
export async function pathTitle(
  fsPath: string,
  roots: RootEntry[],
  budgetMs = TITLE_BUDGET_MS,
): Promise<string> {
  const root = roots.find((r) => path.resolve(r.fsPath) === fsPath);
  if (root) return root.label;
  const name = path.basename(fsPath);
  if (fs.statSync(fsPath).isDirectory()) return name;
  const doc = await withinBudget(loadMarkdownDocument(fsPath), budgetMs, null);
  return doc?.title ?? name;
}
