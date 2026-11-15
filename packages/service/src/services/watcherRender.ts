/**
 * Rendering a file through jeeves-watcher (`POST /render`, through its SDK)
 * within the render budget, telling a rendering apart from "no rendering"
 * and from an unreachable watcher.
 *
 * @packageDocumentation
 */

import type { RenderResponse } from '@karmaniverous/jeeves-watcher-sdk';

import {
  toWatcherPath,
  WATCHER_TIMEOUT_MS,
  watcherAnswered,
  watcherClient,
} from './watcher.js';

/** The outcome of asking the watcher to render a file. */
export type WatcherRenderOutcome =
  | { status: 'rendered'; data: RenderResponse }
  /** No rule matched, or the watcher answered with an error. */
  | { status: 'none' }
  /** Network failure, timeout or bad URL. */
  | { status: 'unreachable'; error: unknown };

/**
 * Ask the watcher to render a file (5 s budget). Only an unreached watcher
 * is logged.
 *
 * @param fsPath - File system path.
 * @returns The outcome.
 */
export async function renderViaWatcher(
  fsPath: string,
): Promise<WatcherRenderOutcome> {
  try {
    const data = await watcherClient(WATCHER_TIMEOUT_MS.render).render({
      path: toWatcherPath(fsPath),
    });
    return data.rules.length === 0
      ? { status: 'none' }
      : { status: 'rendered', data };
  } catch (error) {
    if (watcherAnswered(error)) return { status: 'none' };
    console.warn('Watcher render failed for ' + fsPath + ':', error);
    return { status: 'unreachable', error };
  }
}
