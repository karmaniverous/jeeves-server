/**
 * Render-state signal between rendered pages and the export renderer
 * (#295). Pages set `data-render-state` on `<html>`; the renderer exports
 * and caches only `ready`. The SPA keeps its own copy of these values
 * (`client/src/lib/renderState.ts`), as it is built separately.
 *
 * @packageDocumentation
 */

/** Attribute on `<html>` that carries the render state. */
export const RENDER_STATE_ATTR = 'data-render-state';

/** Values of `<html data-render-state>`. */
export type RenderState = 'ready' | 'auth-required' | 'error';

/** The render state values by name. */
export const RENDER_STATE = {
  ready: 'ready',
  authRequired: 'auth-required',
  error: 'error',
} as const satisfies Record<string, RenderState>;

/**
 * The attribute as it appears in an opening `<html>` tag (with a leading
 * space), or an empty string when no state is given.
 */
export function renderStateAttribute(state?: RenderState): string {
  return state ? ` ${RENDER_STATE_ATTR}="${state}"` : '';
}
