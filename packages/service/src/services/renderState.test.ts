/**
 * #295: the export renderer accepts only `data-render-state="ready"`; the
 * server-rendered sign-in and error pages announce themselves.
 *
 * @packageDocumentation
 */

import type { Page } from 'puppeteer-core';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/index.js', () => ({
  getConfig: () => ({ chromePath: 'chrome' }),
}));

const { assertRenderReady, RenderFailedError, RENDER_TIMEOUT_MS } =
  await import('./puppeteer.js');
const { renderSignInPage } = await import('../auth/signInPage.js');
const { renderErrorPage } = await import('../auth/errorPage.js');

const waitForSelector = vi.fn();

/** Fake page whose root reports `state` (or never sets one). */
function fakePage(state: string | null): Page {
  waitForSelector.mockReset();
  waitForSelector.mockImplementation(
    (_selector: string, opts: { timeout: number }) =>
      state === null
        ? Promise.reject(new Error(`timeout ${String(opts.timeout)}`))
        : Promise.resolve({}),
  );
  return {
    waitForSelector,
    evaluate: vi.fn(() => Promise.resolve(state)),
  } as unknown as Page;
}

describe('assertRenderReady', () => {
  it('resolves when the page reports ready', async () => {
    const page = fakePage('ready');
    await expect(assertRenderReady(page)).resolves.toBeUndefined();
    expect(waitForSelector).toHaveBeenCalledWith('html[data-render-state]', {
      timeout: RENDER_TIMEOUT_MS,
    });
  });

  it.each([
    ['auth-required', 'auth-required'],
    ['error', 'error'],
    ['an unknown value', 'error'],
  ])('rejects when the page reports %s', async (_label, expected) => {
    const page = fakePage(_label === 'an unknown value' ? 'weird' : _label);
    const err = await assertRenderReady(page).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RenderFailedError);
    expect((err as InstanceType<typeof RenderFailedError>).renderState).toBe(
      expected,
    );
  });

  it('rejects with timeout when no state is ever set', async () => {
    const err = await assertRenderReady(fakePage(null)).catch(
      (e: unknown) => e,
    );
    expect((err as InstanceType<typeof RenderFailedError>).renderState).toBe(
      'timeout',
    );
  });
});

describe('server-rendered pages announce their render state', () => {
  it('sign-in page is auth-required', () => {
    const html = renderSignInPage('/browse/r/a.md', ['keys']);
    expect(html).toContain(
      '<html lang="en" data-render-state="auth-required">',
    );
  });

  it('error page is error', () => {
    expect(renderErrorPage('t', 'm')).toContain('data-render-state="error"');
  });
});
