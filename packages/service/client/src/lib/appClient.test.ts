import { isServerError, ServerError } from '@karmaniverous/jeeves-server-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAppClient, withSignInRedirect } from './appClient';
import { pageShareCredential } from './pageAuth';

/** A JSON response. */
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** Stub `fetch` with one response; returns the mock. */
function stubFetch(response: Response) {
  const fetch = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

/** The URL and init of the stubbed fetch's only call. */
function sent(fetch: ReturnType<typeof vi.fn>) {
  const [input, init] = fetch.mock.calls[0] as [
    string | URL | Request,
    RequestInit | undefined,
  ];
  const url = new URL(input instanceof Request ? input.url : String(input));
  const credentials =
    init?.credentials ??
    (input instanceof Request ? input.credentials : undefined);
  return { url, credentials };
}

const origin = 'http://jeeves.test';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createAppClient auth selection', () => {
  it('uses the browser session when the page has no share credential', async () => {
    const fetch = stubFetch(json([]));
    await createAppClient({ origin, share: undefined }).drives();
    const { url, credentials } = sent(fetch);
    expect(url.pathname).toBe('/api/drives');
    expect(url.search).toBe('');
    expect(credentials).toBe('same-origin');
  });

  it("sends the page's share credential on every request", async () => {
    const share = pageShareCredential('?key=abc&d=2&dirs=1&exp=9&tab=raw');
    const fetch = stubFetch(json([]));
    await createAppClient({ origin, share }).drives();
    const { url } = sent(fetch);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      k: 'abc',
      d: '2',
      dirs: '1',
      exp: '9',
    });
  });
});

describe('withSignInRedirect', () => {
  const unauthorized = {
    statusCode: 401,
    code: 'SERVER_UNAUTHORIZED',
    error: 'Unauthorized',
    message: 'Authentication required',
  };

  it('signs in on SERVER_UNAUTHORIZED and rethrows the ServerError', async () => {
    stubFetch(json(unauthorized, 401));
    const signIn = vi.fn();
    const api = withSignInRedirect(
      createAppClient({ origin, share: undefined }),
      signIn,
    );
    const error: unknown = await api.drives().catch((e: unknown) => e);
    expect(isServerError(error) && error.code).toBe('SERVER_UNAUTHORIZED');
    expect(signIn).toHaveBeenCalledOnce();
  });

  it('passes other failures through without signing in', async () => {
    stubFetch(
      json(
        {
          statusCode: 403,
          code: 'SERVER_OUT_OF_SCOPE',
          error: 'Forbidden',
          message: 'Out of scope',
        },
        403,
      ),
    );
    const signIn = vi.fn();
    const api = withSignInRedirect(
      createAppClient({ origin, share: undefined }),
      signIn,
    );
    await expect(api.drives()).rejects.toBeInstanceOf(ServerError);
    expect(signIn).not.toHaveBeenCalled();
  });

  it('returns results unchanged', async () => {
    stubFetch(json([{ letter: 'j', label: 'J' }]));
    const api = withSignInRedirect(
      createAppClient({ origin, share: undefined }),
      vi.fn(),
    );
    await expect(api.drives()).resolves.toEqual([{ letter: 'j', label: 'J' }]);
  });
});
