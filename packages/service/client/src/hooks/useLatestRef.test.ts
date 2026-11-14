import { describe, expect, it } from 'vitest';

import { renderHook } from '@/test/reactHarness';

import { useLatestRef } from './useLatestRef';

describe('useLatestRef', () => {
  it('keeps one ref holding the latest committed value', async () => {
    const hook = await renderHook(
      ({ value }: { value: string }) => useLatestRef(value),
      { value: 'a' },
    );
    const first = hook.result.current;
    expect(first?.current).toBe('a');

    await hook.rerender({ value: 'b' });
    expect(hook.result.current).toBe(first);
    expect(first?.current).toBe('b');
    await hook.unmount();
  });
});
