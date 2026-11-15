/**
 * The `fetch` wrapper applying share and session credentials, whatever form the request URL takes.
 */

import { describe, expect, it, vi } from 'vitest';

import { catalogAuth, type FetchLike, withAuth } from './auth.js';

describe('withAuth', () => {
  it('reads the URL of a string, a URL or a Request', async () => {
    const fetch = vi.fn<FetchLike>(() => Promise.resolve(new Response()));
    const wrapped = withAuth(fetch, { share: { k: 'pk' } });
    await wrapped('http://h/a', {});
    await wrapped(new URL('http://h/b?x=1'));
    await wrapped(new Request('http://h/c'));
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'http://h/a?k=pk',
      'http://h/b?x=1&k=pk',
      'http://h/c?k=pk',
    ]);
  });

  it('passes requests through untouched without a share or session', async () => {
    const fetch = vi.fn<FetchLike>(() => Promise.resolve(new Response()));
    await withAuth(fetch, { key: 'k1' })('http://h/a?x=1', { method: 'GET' });
    expect(fetch).toHaveBeenCalledWith('http://h/a?x=1', { method: 'GET' });
  });
});

describe('catalogAuth', () => {
  it('hands only a key to the catalog client, as k', () => {
    expect(catalogAuth({ key: 'k1' })).toEqual({
      query: { name: 'k', value: 'k1' },
    });
    expect(catalogAuth({ session: true })).toBeUndefined();
    expect(catalogAuth(undefined)).toBeUndefined();
  });
});
