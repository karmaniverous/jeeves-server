/**
 * Tests for the watcher access helpers: client construction at the
 * core-resolved URL, the watcher path form, and the reading of failed
 * calls (answered or not, the transport error behind it).
 *
 * @packageDocumentation
 */

import { CatalogClientError } from '@karmaniverous/jeeves/catalog';
import { WatcherError } from '@karmaniverous/jeeves-watcher-sdk';
import { describe, expect, it, vi } from 'vitest';

const createWatcherClient = vi.hoisted(() => vi.fn(() => ({ marker: 1 })));

vi.mock('@karmaniverous/jeeves', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getServiceUrl: (name: string) => `http://${name}.test:1936`,
}));
vi.mock('@karmaniverous/jeeves-watcher-sdk', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createWatcherClient,
}));

const {
  toWatcherPath,
  transportCause,
  transportMessage,
  watcherAnswered,
  watcherClient,
} = await import('./watcher.js');

const fetchFailed = new TypeError('fetch failed');
const unreachable = new WatcherError({
  code: 'network_error',
  message: 'search request failed: fetch failed',
  cause: new CatalogClientError('search request failed', {
    status: 0,
    cause: fetchFailed,
  }),
});

describe('watcherClient', () => {
  it('builds an SDK client at the watcher URL with the given budget', () => {
    expect(watcherClient(1234)).toEqual({ marker: 1 });
    expect(createWatcherClient).toHaveBeenCalledWith({
      baseUrl: 'http://watcher.test:1936',
      timeoutMs: 1234,
    });
  });
});

describe('toWatcherPath', () => {
  it.each([
    ['J:\\docs\\a.json', 'j:/docs/a.json'],
    ['/srv/docs/a.json', '/srv/docs/a.json'],
    ['j:/x', 'j:/x'],
  ])('maps %s to %s', (input, expected) => {
    expect(toWatcherPath(input)).toBe(expected);
  });
});

describe('watcherAnswered', () => {
  it.each([
    [
      'an HTTP error',
      new WatcherError({ code: 'http_500', message: 'x', status: 500 }),
      true,
    ],
    [
      'a bad 2xx body',
      new WatcherError({ code: 'invalid_response', message: 'x', status: 200 }),
      true,
    ],
    [
      'a refused request',
      new WatcherError({ code: 'invalid_request', message: 'x' }),
      true,
    ],
    ['a network failure', unreachable, false],
    ['a timeout', new WatcherError({ code: 'timeout', message: 'x' }), false],
    ['a non-SDK error', new Error('x'), false],
  ])('is %s answered: %s', (_label, err, expected) => {
    expect(watcherAnswered(err)).toBe(expected);
  });
});

describe('transportCause / transportMessage', () => {
  it("unwraps the SDK and catalog errors to fetch's error", () => {
    expect(transportCause(unreachable)).toBe(fetchFailed);
    expect(String(transportCause(unreachable))).toBe('TypeError: fetch failed');
    expect(transportMessage(unreachable)).toBe('fetch failed');
  });

  it('keeps a catalog error that has no cause', () => {
    const inner = new CatalogClientError('render request failed', {
      status: 0,
    });
    const err = new WatcherError({ code: 'x', message: 'y', cause: inner });
    expect(transportCause(err)).toBe(inner);
  });

  it('returns a non-catalog cause as is', () => {
    const cause = new RangeError('boom');
    const err = new WatcherError({ code: 'x', message: 'y', cause });
    expect(transportCause(err)).toBe(cause);
  });

  it('returns a cause-less SDK error itself', () => {
    const err = new WatcherError({
      code: 'invalid_options',
      message: 'bad url',
    });
    expect(transportCause(err)).toBe(err);
    expect(transportMessage(err)).toBe('bad url');
  });

  it('passes other values through', () => {
    expect(transportCause('raw')).toBe('raw');
    expect(transportMessage('raw')).toBe('raw');
  });
});
