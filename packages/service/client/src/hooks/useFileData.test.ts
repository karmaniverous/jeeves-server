import { ServerError } from '@karmaniverous/jeeves-server-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook } from '@/test/reactHarness';

const server = vi.hoisted(() => ({
  drives: vi.fn(),
  browse: vi.fn(),
  fileContent: vi.fn(),
  fileWrite: vi.fn(),
}));
vi.mock('@/lib/server', () => ({ server }));

const { useFileData } = await import('./useFileData');

type Props = { path: string; query: string };
const useProbe = ({ path, query }: Props) =>
  useFileData(path, new URLSearchParams(query));

describe('useFileData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.browse.mockResolvedValue({ entries: [] });
  });

  it('reloads on a path change only, with the tab current at that moment', async () => {
    const hook = await renderHook(useProbe, { path: 'j/a', query: '' });
    expect(server.browse).toHaveBeenCalledExactlyOnceWith({ '*': 'j/a' });
    expect(hook.result.current?.viewTab).toBe('rendered');

    // A tab param change alone doesn't reload (nor reset the view tab).
    await hook.rerender({ path: 'j/a', query: 'tab=raw' });
    expect(server.browse).toHaveBeenCalledOnce();
    expect(hook.result.current?.viewTab).toBe('rendered');

    // The next path change loads with the latest params.
    await hook.rerender({ path: 'j/b', query: 'tab=raw' });
    expect(server.browse).toHaveBeenLastCalledWith({ '*': 'j/b' });
    expect(server.browse).toHaveBeenCalledTimes(2);
    expect(hook.result.current?.viewTab).toBe('raw');
    expect(hook.result.current?.directory).toEqual({ entries: [] });
    await hook.unmount();
  });

  it('loads drives at the root', async () => {
    server.drives.mockResolvedValue([{ name: 'j' }]);
    const hook = await renderHook(useProbe, { path: '', query: '' });
    expect(server.drives).toHaveBeenCalledOnce();
    expect(hook.result.current?.drives).toEqual([{ name: 'j' }]);
    await hook.unmount();
  });

  it('loads a file raw and rendered', async () => {
    server.browse.mockResolvedValue({ fileName: 'a.md' });
    server.fileContent.mockImplementation((input: { raw?: string }) =>
      Promise.resolve({ fileName: 'a.md', type: input.raw ? 'raw' : 'html' }),
    );
    const hook = await renderHook(useProbe, { path: 'j/a.md', query: '' });
    expect(server.fileContent).toHaveBeenCalledWith({ '*': 'j/a.md', raw: '1' });
    expect(server.fileContent).toHaveBeenCalledWith({ '*': 'j/a.md' });
    expect(hook.result.current?.fileRaw).toEqual({
      fileName: 'a.md',
      type: 'raw',
    });
    expect(hook.result.current?.fileRendered).toEqual({
      fileName: 'a.md',
      type: 'html',
    });
    await hook.unmount();
  });

  it('shows a failed load by its code: Unauthorized, else the server message', async () => {
    server.browse.mockRejectedValue(
      new ServerError({ code: 'SERVER_NOT_FOUND', status: 404, message: 'x' }),
    );
    server.fileContent.mockImplementation((input: { raw?: string }) =>
      Promise.reject(
        input.raw
          ? new ServerError({
              code: 'SERVER_NOT_FOUND',
              status: 404,
              message: 'Not found: j/a.md',
            })
          : new ServerError({
              code: 'SERVER_UNAUTHORIZED',
              status: 401,
              message: 'Authentication required',
            }),
      ),
    );
    const hook = await renderHook(useProbe, { path: 'j/a.md', query: '' });
    expect(hook.result.current?.error).toBe('Not found: j/a.md');
    expect(hook.result.current?.renderError).toBe('Unauthorized');
    await hook.unmount();
  });
});
