import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook, settle } from '@/test/reactHarness';

const server = vi.hoisted(() => ({ fileWrite: vi.fn() }));
vi.mock('@/lib/server', () => ({ server }));

const undo = vi.hoisted(() => ({
  pushUndo: vi.fn(),
  peekUndo: vi.fn(),
  peekRedo: vi.fn(),
  confirmUndo: vi.fn(),
  confirmRedo: vi.fn(),
  canUndo: vi.fn(),
  canRedo: vi.fn(),
}));
vi.mock('@/lib/useUndo', () => ({ useUndo: () => undo }));

const { useUndoRedo } = await import('./useUndoRedo');

const refetch = vi.fn();
const useProbe = ({ content }: { content: string }) =>
  useUndoRedo('j/a.md', content, refetch);

describe('useUndoRedo', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    server.fileWrite.mockResolvedValue({ ok: true });
    refetch.mockResolvedValue(undefined);
  });

  it.each([
    ['handleUndo', 'peekUndo', 'confirmUndo', 'confirmRedo'],
    ['handleRedo', 'peekRedo', 'confirmRedo', 'confirmUndo'],
  ] as const)(
    '%s writes the stored version, records the current content, reloads',
    async (handler, peek, confirm, other) => {
      undo[peek].mockReturnValue('# old');
      const hook = await renderHook(useProbe, { content: '# now' });
      await settle(() => void hook.result.current![handler]());
      expect(server.fileWrite).toHaveBeenCalledExactlyOnceWith({
        '*': 'j/a.md',
        content: '# old',
      });
      expect(undo[confirm]).toHaveBeenCalledExactlyOnceWith('j/a.md', '# now');
      expect(undo[other]).not.toHaveBeenCalled();
      expect(refetch).toHaveBeenCalledOnce();
      expect(hook.result.current?.saving).toBe(false);
      await hook.unmount();
    },
  );

  it('does nothing with an empty stack', async () => {
    const hook = await renderHook(useProbe, { content: '# now' });
    await settle(() => void hook.result.current!.handleUndo());
    expect(server.fileWrite).not.toHaveBeenCalled();
    await hook.unmount();
  });

  it('is saving while the write is in flight, and not after a failed one', async () => {
    undo.peekUndo.mockReturnValue('# old');
    let fail: (e: Error) => void = () => undefined;
    server.fileWrite.mockReturnValue(
      new Promise((_, reject) => {
        fail = reject;
      }),
    );
    const hook = await renderHook(useProbe, { content: '# now' });
    let pending: Promise<unknown> | undefined;
    await settle(() => {
      pending = hook.result.current!.handleUndo().catch((e: unknown) => e);
    });
    expect(hook.result.current?.saving).toBe(true);
    await settle(() => fail(new Error('down')));
    await expect(pending).resolves.toMatchObject({ message: 'down' });
    expect(undo.confirmUndo).not.toHaveBeenCalled();
    expect(hook.result.current?.saving).toBe(false);
    await hook.unmount();
  });

  it('reports whether undo and redo are available for the file', async () => {
    undo.canUndo.mockReturnValue(true);
    undo.canRedo.mockReturnValue(false);
    const hook = await renderHook(useProbe, { content: '' });
    expect(hook.result.current).toMatchObject({
      canUndo: true,
      canRedo: false,
    });
    expect(undo.canUndo).toHaveBeenCalledWith('j/a.md');
    await hook.unmount();
  });
});
