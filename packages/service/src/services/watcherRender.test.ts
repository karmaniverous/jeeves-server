/**
 * Tests for rendering through jeeves-watcher: path and budget, and the
 * three outcomes (rendered, none, unreachable).
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@karmaniverous/jeeves', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getServiceUrl: () => 'http://watcher:1936',
}));
const render = vi.hoisted(() => vi.fn());
const createWatcherClient = vi.hoisted(() => vi.fn(() => ({ render })));
vi.mock('@karmaniverous/jeeves-watcher-sdk', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createWatcherClient,
}));

const { WatcherError } = await import('@karmaniverous/jeeves-watcher-sdk');
const { renderViaWatcher } = await import('./watcherRender.js');

describe('renderViaWatcher', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    render.mockReset();
    createWatcherClient.mockClear();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a normalised path within the 5 s budget', async () => {
    const data = { renderAs: 'md', content: 'x', rules: ['r'], metadata: {} };
    render.mockResolvedValue(data);
    await expect(renderViaWatcher('J:\\docs\\a.json')).resolves.toEqual({
      status: 'rendered',
      data,
    });
    expect(createWatcherClient).toHaveBeenCalledWith({
      baseUrl: 'http://watcher:1936',
      timeoutMs: 5000,
    });
    expect(render).toHaveBeenCalledWith({ path: 'j:/docs/a.json' });
  });

  it('answers none when no rules match', async () => {
    render.mockResolvedValue({
      renderAs: 'md',
      content: '',
      rules: [],
      metadata: {},
    });
    await expect(renderViaWatcher('/a')).resolves.toEqual({ status: 'none' });
  });

  it('answers none without logging when the watcher answers an error', async () => {
    render.mockRejectedValue(
      new WatcherError({ code: 'http_500', message: 'boom', status: 500 }),
    );
    await expect(renderViaWatcher('/a')).resolves.toEqual({ status: 'none' });
    expect(warn).not.toHaveBeenCalled();
  });

  it('answers unreachable and logs when the watcher is not reached', async () => {
    const err = new WatcherError({ code: 'network_error', message: 'down' });
    render.mockRejectedValue(err);
    await expect(renderViaWatcher('/a')).resolves.toEqual({
      status: 'unreachable',
      error: err,
    });
    expect(warn).toHaveBeenCalledWith('Watcher render failed for /a:', err);
  });

  it('answers unreachable when the client cannot be built', async () => {
    createWatcherClient.mockImplementationOnce(() => {
      throw new WatcherError({ code: 'invalid_options', message: 'bad url' });
    });
    await expect(renderViaWatcher('/a')).resolves.toMatchObject({
      status: 'unreachable',
    });
    expect(warn).toHaveBeenCalledOnce();
  });
});
