/**
 * Render-state signal for the export renderer (#295). The SPA sets
 * `data-render-state` on `<html>` once the requested view has rendered
 * (`ready`) or cannot render (`auth-required` / `error`). Puppeteer waits
 * for the attribute and refuses to export or cache anything but `ready`.
 */

/** Values of `<html data-render-state>`. */
export type RenderState = 'ready' | 'auth-required' | 'error';

/** The parts of the file-browser state that decide the render state. */
export interface RenderStateInput {
  /** Requested path ('' for the drive list). */
  reqPath: string;
  loading: boolean;
  /** Load error message, if any (`Unauthorized` for a 401). */
  error: string | null;
  /** Drive list, when the drive list was requested. */
  hasDrives: boolean;
  /** Directory listing, when a directory was requested. */
  hasDirectory: boolean;
  /** Raw file payload has loaded. */
  hasFileRaw: boolean;
  /** Rendered file payload has loaded. */
  hasFileRendered: boolean;
  /** File type, when known. */
  fileType?: string;
  /** Rendered-view request failed. */
  renderError: string | null;
  /** Active tab. */
  viewTab: 'rendered' | 'raw';
}

/** Error message the API client throws for a 401. */
const UNAUTHORIZED = 'Unauthorized';

/**
 * Decide the render state, or `null` while the view is still loading.
 * Markdown in the rendered tab is ready only once its rendered HTML has
 * loaded; everything else is ready once its data has loaded.
 */
export function computeRenderState(input: RenderStateInput): RenderState | null {
  if (input.error)
    return input.error === UNAUTHORIZED ? 'auth-required' : 'error';
  if (input.loading) return null;
  if (!input.reqPath) return input.hasDrives ? 'ready' : null;
  if (input.hasDirectory) return 'ready';

  const needsRendered =
    input.viewTab === 'rendered' && input.fileType === 'markdown';
  if (needsRendered) {
    if (input.hasFileRendered) return 'ready';
    if (input.renderError)
      return input.renderError === UNAUTHORIZED ? 'auth-required' : 'error';
    return null;
  }
  return input.hasFileRaw || input.hasFileRendered ? 'ready' : null;
}

/** Set (or clear, for `null`) `data-render-state` on the document root. */
export function applyRenderState(
  state: RenderState | null,
  root: HTMLElement = document.documentElement,
): void {
  if (state) root.setAttribute('data-render-state', state);
  else root.removeAttribute('data-render-state');
}
