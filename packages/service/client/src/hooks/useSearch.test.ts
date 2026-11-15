import { ServerError } from '@karmaniverous/jeeves-server-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SearchFilter } from '@/lib/searchFacets';
import { renderHook, settle } from '@/test/reactHarness';

const server = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock('@/lib/server', () => ({ server }));

const { SEARCH_DEBOUNCE_MS, useSearch } = await import('./useSearch');

type Props = { filter: SearchFilter | undefined };

const render = (filter?: SearchFilter) =>
  renderHook(({ filter }: Props) => useSearch(filter), { filter });

/** Let the debounce elapse (and the search it starts settle). */
const debounce = () => settle(undefined, SEARCH_DEBOUNCE_MS + 50);

const kindFilter: SearchFilter = {
  must: [{ key: 'kind', match: { any: ['doc'] } }],
};

describe('useSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.search.mockResolvedValue({ results: [{ browsePath: 'j/a.md' }] });
  });

  it('searches the last typed query once typing pauses, with the filter', async () => {
    const hook = await render(kindFilter);
    await settle(() => {
      hook.result.current?.setQuery('pl');
    });
    await settle(() => {
      hook.result.current?.setQuery('plan');
    });
    expect(hook.result.current?.query).toBe('plan');
    expect(server.search).not.toHaveBeenCalled();

    await debounce();
    expect(server.search).toHaveBeenCalledExactlyOnceWith({
      query: 'plan',
      limit: 30,
      filter: kindFilter,
    });
    expect(hook.result.current?.results).toEqual([{ browsePath: 'j/a.md' }]);
    expect(hook.result.current?.loading).toBe(false);
    await hook.unmount();
  });

  it('re-runs the current query, without a filter, when the filter changes', async () => {
    const hook = await render(kindFilter);
    await settle(() => {
      hook.result.current?.setQuery('plan');
    });
    await debounce();
    server.search.mockClear();

    await hook.rerender({ filter: undefined });
    expect(server.search).toHaveBeenCalledExactlyOnceWith({
      query: 'plan',
      limit: 30,
    });
    await hook.unmount();
  });

  it('clears the results for a blank query without searching', async () => {
    const hook = await render();
    await settle(() => {
      hook.result.current?.setQuery('plan');
    });
    await debounce();
    await settle(() => {
      hook.result.current?.setQuery('  ');
    });
    await debounce();
    expect(server.search).toHaveBeenCalledOnce();
    expect(hook.result.current?.results).toEqual([]);
    await hook.unmount();
  });

  it('shows a failed search by its error, and reset clears everything', async () => {
    server.search.mockRejectedValue(
      new ServerError({
        code: 'SERVER_NOT_CONFIGURED',
        status: 503,
        message: 'x',
      }),
    );
    const hook = await render();
    await settle(() => {
      hook.result.current?.setQuery('plan');
    });
    await debounce();
    expect(hook.result.current?.error).toBe(
      'Search is not configured on this server.',
    );
    expect(hook.result.current?.loading).toBe(false);

    await settle(() => {
      hook.result.current?.reset();
    });
    expect(hook.result.current?.query).toBe('');
    expect(hook.result.current?.error).toBeNull();
    expect(hook.result.current?.results).toEqual([]);
    await hook.unmount();
  });
});
