import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook } from '@/test/reactHarness';

const api = vi.hoisted(() => ({
  getDrives: vi.fn(),
  getDirectory: vi.fn(),
  getFile: vi.fn(),
  getFileRaw: vi.fn(),
  saveFile: vi.fn(),
}));
vi.mock('@/lib/api', () => api);

const { useFileData } = await import('./useFileData');

type Props = { path: string; query: string };
const useProbe = ({ path, query }: Props) =>
  useFileData(path, new URLSearchParams(query));

describe('useFileData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getDirectory.mockResolvedValue({ entries: [] });
  });

  it('reloads on a path change only, with the tab current at that moment', async () => {
    const hook = await renderHook(useProbe, { path: 'j/a', query: '' });
    expect(api.getDirectory).toHaveBeenCalledExactlyOnceWith('j/a');
    expect(hook.result.current?.viewTab).toBe('rendered');

    // A tab param change alone doesn't reload (nor reset the view tab).
    await hook.rerender({ path: 'j/a', query: 'tab=raw' });
    expect(api.getDirectory).toHaveBeenCalledOnce();
    expect(hook.result.current?.viewTab).toBe('rendered');

    // The next path change loads with the latest params.
    await hook.rerender({ path: 'j/b', query: 'tab=raw' });
    expect(api.getDirectory).toHaveBeenLastCalledWith('j/b');
    expect(api.getDirectory).toHaveBeenCalledTimes(2);
    expect(hook.result.current?.viewTab).toBe('raw');
    expect(hook.result.current?.directory).toEqual({ entries: [] });
    await hook.unmount();
  });

  it('loads drives at the root', async () => {
    api.getDrives.mockResolvedValue([{ name: 'j' }]);
    const hook = await renderHook(useProbe, { path: '', query: '' });
    expect(api.getDrives).toHaveBeenCalledOnce();
    expect(hook.result.current?.drives).toEqual([{ name: 'j' }]);
    await hook.unmount();
  });
});
