import { describe, expect, it, vi } from 'vitest';

import { renderHook } from '@/test/reactHarness';

import { useRerunSearch } from './useRerunSearch';

type Props = { query: string; search: (q: string) => Promise<void> };

const searchFn = () => vi.fn((q: string) => Promise.resolve(void q));

describe('useRerunSearch', () => {
  it('re-runs the search with the current query when the filters change', async () => {
    const first = searchFn();
    const hook = await renderHook(
      ({ query, search }: Props) => {
        useRerunSearch(query, search);
      },
      { query: '', search: first },
    );
    // Mounting with a blank query searches nothing.
    expect(first).not.toHaveBeenCalled();

    // Typing alone (same search callback) doesn't re-run it.
    await hook.rerender({ query: 'plan', search: first });
    expect(first).not.toHaveBeenCalled();

    // New filters (a new search callback) re-run with the typed query.
    const second = searchFn();
    await hook.rerender({ query: 'plan', search: second });
    expect(second).toHaveBeenCalledExactlyOnceWith('plan');

    // A reset (blank query and new filters together) searches nothing.
    const third = searchFn();
    await hook.rerender({ query: ' ', search: third });
    expect(third).not.toHaveBeenCalled();
    await hook.unmount();
  });
});
