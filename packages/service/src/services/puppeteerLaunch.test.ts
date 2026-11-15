/**
 * `requireChrome` and `launchBrowser`: a missing or failing Chrome is `SERVER_CHROME_UNAVAILABLE`, with the launch error kept as the (logged, never sent) cause.
 */

import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted((): { chromePath?: string } => ({}));
const launch = vi.hoisted(() => vi.fn());

vi.mock('../config/index.js', () => ({
  getConfig: () => ({ chromePath: state.chromePath }),
}));
vi.mock('puppeteer-core', () => ({ default: { launch } }));

const { launchBrowser, requireChrome } = await import('./puppeteer.js');

const UNAVAILABLE = {
  statusCode: 503,
  code: 'SERVER_CHROME_UNAVAILABLE',
  message: 'Export unavailable: Chrome could not be started (check chromePath)',
};

beforeEach(() => {
  state.chromePath = process.execPath;
  launch.mockReset();
});

describe('requireChrome', () => {
  it('returns an existing chromePath', () => {
    expect(requireChrome()).toBe(process.execPath);
  });

  it.each([
    ['unset', undefined],
    ['missing', path.join(path.dirname(process.execPath), 'no-such-chrome')],
  ])('throws SERVER_CHROME_UNAVAILABLE when chromePath is %s', (_l, value) => {
    state.chromePath = value;
    expect(() => requireChrome()).toThrow(
      expect.objectContaining(UNAVAILABLE) as Error,
    );
  });
});

describe('launchBrowser', () => {
  it('launches the configured Chrome headless', async () => {
    const browser = {};
    launch.mockResolvedValue(browser);
    await expect(launchBrowser()).resolves.toBe(browser);
    expect(launch).toHaveBeenCalledWith(
      expect.objectContaining({
        executablePath: process.execPath,
        headless: true,
      }),
    );
  });

  it('throws SERVER_CHROME_UNAVAILABLE with the launch error as cause', async () => {
    const cause = new Error('Failed to launch the browser process');
    launch.mockRejectedValue(cause);
    await expect(launchBrowser()).rejects.toMatchObject({
      ...UNAVAILABLE,
      cause,
    });
  });

  it('does not launch without a Chrome', async () => {
    state.chromePath = undefined;
    await expect(launchBrowser()).rejects.toMatchObject(UNAVAILABLE);
    expect(launch).not.toHaveBeenCalled();
  });
});
