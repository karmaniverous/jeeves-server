/**
 * The client against a stub `fetch`: one method per catalog entry, the three credentials (key on the entries that list `k`, share on every request, session as `credentials: 'same-origin'`), timeouts (default, `export`, per call), bytes for binary entries and every failure a `ServerError`.
 */

import { SERVER_CATALOG } from '@karmaniverous/jeeves-server-core/catalog';
import { describe, expect, it, vi } from 'vitest';

import type { FetchLike, ServerAuth } from './auth.js';
import { createServerClient } from './createServerClient.js';
import { DEFAULT_TIMEOUT_MS, EXPORT_TIMEOUT_MS } from './options.js';
import type { ServerError } from './ServerError.js';

const BASE = 'http://127.0.0.1:1934';

/** A stub fetch answering every request with `reply`, recording the calls. */
const stub = (reply: () => Response = () => Response.json({ ok: true })) =>
  vi.fn<FetchLike>(() => Promise.resolve(reply()));

/** A client over a stub fetch. */
const clientWith = (fetch: FetchLike, auth?: ServerAuth) =>
  createServerClient({ baseUrl: `${BASE}/`, fetch, ...(auth ? { auth } : {}) });

/** The URL of the stub's last call. */
const lastUrl = (fetch: ReturnType<typeof stub>) => fetch.mock.lastCall?.[0];

/** The rejection of a promise. */
const rejection = async (promise: Promise<unknown>): Promise<ServerError> =>
  promise.then(
    () => {
      throw new Error('resolved');
    },
    (error: unknown) => error as ServerError,
  );

describe('createServerClient', () => {
  it('has one method per catalog entry', () => {
    const client = clientWith(stub());
    expect(Object.keys(client).sort()).toEqual(
      SERVER_CATALOG.entries.map((e) => e.name).sort(),
    );
  });

  it('sends a key as k to entries that list it, never to public ones', async () => {
    const fetch = stub();
    const client = clientWith(fetch, { key: 'insider' });
    await client.runnerPut({ '*': 'jobs/a b', enabled: true });
    expect(lastUrl(fetch)).toBe(`${BASE}/api/runner/jobs/a%20b?k=insider`);
    expect(fetch.mock.lastCall?.[1]).toMatchObject({
      method: 'PUT',
      body: '{"enabled":true}',
    });
    expect(fetch.mock.lastCall?.[1].credentials).toBeUndefined();
    await client.health();
    expect(lastUrl(fetch)).toBe(`${BASE}/health`);
  });

  it('adds a share credential to every request, keeping its own query', async () => {
    const fetch = stub();
    const client = clientWith(fetch, {
      share: { k: 'pk', exp: '9', s: 'a+b' },
    });
    await client.raw({ '*': 'j/a.pdf', download: '1' });
    expect(lastUrl(fetch)).toBe(
      `${BASE}/api/raw/j/a.pdf?download=1&k=pk&exp=9&s=a%2Bb`,
    );
    await client.health();
    expect(lastUrl(fetch)).toBe(`${BASE}/health?k=pk&exp=9&s=a%2Bb`);
  });

  it("sends a session's cookie with credentials: 'same-origin'", async () => {
    const fetch = stub();
    await clientWith(fetch, { session: true }).runnerGet({ '*': 'jobs' });
    expect(lastUrl(fetch)).toBe(`${BASE}/api/runner/jobs`);
    expect(fetch.mock.lastCall?.[1].credentials).toBe('same-origin');
  });

  it('resolves binary entries to bytes', async () => {
    const fetch = stub(() => new Response(new Uint8Array([1, 2, 3])));
    const bytes = await clientWith(fetch).diagram({
      type: 'mermaid',
      hash: 'abc',
    });
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect([...bytes]).toEqual([1, 2, 3]);
  });

  it('times out after 120 s by default, export after 10 min, or per call', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const client = clientWith(stub(() => new Response(new Uint8Array([1]))));
    await client.export({ '*': 'j/a.md' });
    expect(timeout).toHaveBeenLastCalledWith(EXPORT_TIMEOUT_MS);
    await client.raw({ '*': 'j/a.md' });
    expect(timeout).toHaveBeenLastCalledWith(DEFAULT_TIMEOUT_MS);
    await client.raw({ '*': 'j/a.md' }, { timeoutMs: 5 });
    expect(timeout).toHaveBeenLastCalledWith(5);
  });

  it('throws timeout when no response arrives in time', async () => {
    const hang: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(init.signal?.reason as Error);
        });
      });
    const error = await rejection(
      clientWith(hang).health(undefined, { timeoutMs: 10 }),
    );
    expect(error).toMatchObject({
      code: 'timeout',
      status: 0,
      message: 'health timed out after 10 ms',
    });
  });

  it('throws a response error with its code, status and message', async () => {
    const body = {
      statusCode: 404,
      code: 'SERVER_NOT_FOUND',
      error: 'Not Found',
      message: 'Not found',
    };
    const fetch = stub(() => Response.json(body, { status: 404 }));
    const error = await rejection(clientWith(fetch).browse({ '*': 'j/x' }));
    expect(error).toMatchObject({
      code: 'SERVER_NOT_FOUND',
      status: 404,
      message: 'Not found',
      body,
    });
  });

  it('refuses invalid input and a bad per-call timeout before sending', async () => {
    const fetch = stub();
    const client = clientWith(fetch);
    const invalid = await rejection(client.browse({} as never));
    expect(invalid).toMatchObject({ code: 'invalid_request', status: 0 });
    const badTimeout = await rejection(
      client.health(undefined, { timeoutMs: 0 }),
    );
    expect(badTimeout).toMatchObject({
      code: 'invalid_options',
      message: 'timeoutMs must be a positive number',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('throws invalid_response for a 2xx that is not JSON', async () => {
    const fetch = stub(() => new Response('<html>'));
    await expect(rejection(clientWith(fetch).health())).resolves.toMatchObject({
      code: 'invalid_response',
      status: 0,
    });
  });

  it('throws network_error when fetch rejects', async () => {
    const fetch = vi.fn<FetchLike>(() =>
      Promise.reject(new TypeError('fetch failed')),
    );
    await expect(rejection(clientWith(fetch).health())).resolves.toMatchObject({
      code: 'network_error',
      status: 0,
      message: 'health request failed: fetch failed',
    });
  });
});

describe('options', () => {
  /** The error creating a client throws. */
  const optionsError = (options: Record<string, unknown>) => {
    try {
      createServerClient({ baseUrl: BASE, fetch: stub(), ...options });
    } catch (error) {
      return error as ServerError;
    }
    throw new Error('did not throw');
  };

  it.each([
    [{ baseUrl: 'ftp://h' }, 'baseUrl must be an http(s) URL, got "ftp://h"'],
    [{ baseUrl: 'nope' }, 'baseUrl must be an http(s) URL, got "nope"'],
    [
      { baseUrl: 'http://h/?' },
      'baseUrl must not contain a query string or fragment, got "http://h/?"',
    ],
    [{ timeoutMs: -1 }, 'timeoutMs must be a positive number'],
    [{ timeoutMs: Infinity }, 'timeoutMs must be a positive number'],
    [{ auth: { key: '' } }, 'auth.key must be a non-empty string'],
    [{ auth: { share: { k: '' } } }, 'auth.share.k must be a non-empty string'],
    [
      { auth: { session: false } },
      'auth must be { key }, { share } or { session: true }',
    ],
  ])('refuses %j', (options, message) => {
    expect(optionsError(options)).toMatchObject({
      code: 'invalid_options',
      status: 0,
      message,
    });
  });

  it('needs a fetch when there is no global one', () => {
    vi.stubGlobal('fetch', undefined);
    try {
      expect(() => createServerClient({ baseUrl: BASE })).toThrow(
        'No fetch implementation available; pass options.fetch',
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('uses the global fetch by default', async () => {
    const fetch = stub();
    vi.stubGlobal('fetch', fetch);
    try {
      await createServerClient({ baseUrl: BASE }).health();
      expect(lastUrl(fetch)).toBe(`${BASE}/health`);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
