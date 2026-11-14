import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook, settle } from '@/test/reactHarness';

const server = vi.hoisted(() => ({ searchFacets: vi.fn() }));
vi.mock('@/lib/server', () => ({ server }));

const { useFacets } = await import('./useFacets');

const render = () => renderHook(() => useFacets(), undefined);

describe('useFacets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('loads and cleans the manifest once, however often asked', async () => {
    server.searchFacets.mockResolvedValue({
      facets: [
        { field: 'kind', type: 'string', uiHint: 'select', values: ['a', ''] },
        { field: 'secret', type: 'string', uiHint: 'hidden', values: ['x'] },
      ],
    });
    const hook = await render();
    expect(server.searchFacets).not.toHaveBeenCalled();
    expect(hook.result.current?.facetsLoading).toBe(false);

    await settle(() => {
      void hook.result.current?.loadFacets();
      void hook.result.current?.loadFacets();
    });
    await settle(() => {
      void hook.result.current?.loadFacets();
    });
    expect(server.searchFacets).toHaveBeenCalledOnce();
    expect(hook.result.current?.facets).toEqual([
      { field: 'kind', type: 'string', uiHint: 'select', values: ['a'] },
    ]);
    expect(hook.result.current?.garbageEntries).toEqual([
      { field: 'kind', removed: ['"" (empty)'], reason: 'empty' },
    ]);
    expect(hook.result.current?.facetsLoading).toBe(false);
    await hook.unmount();
  });

  it('shows no facets when loading fails', async () => {
    server.searchFacets.mockRejectedValue(new Error('down'));
    const hook = await render();
    await settle(() => {
      void hook.result.current?.loadFacets();
    });
    expect(hook.result.current?.facets).toEqual([]);
    expect(hook.result.current?.facetsLoading).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      'Failed to load facets:',
      expect.any(Error),
    );
    await hook.unmount();
  });
});
