import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook } from '@/test/reactHarness';

const server = vi.hoisted(() => ({ fileMutate: vi.fn() }));
vi.mock('@/lib/server', () => ({ server }));

const { useTaskCheckboxes } = await import('./useTaskCheckboxes');

/** An article with two task checkboxes (disabled, as rendered). */
function article(): HTMLElement {
  const el = document.createElement('article');
  el.innerHTML =
    '<input type="checkbox" data-checkbox-index="0" disabled><input type="checkbox" data-checkbox-index="1" disabled><input type="checkbox">';
  return el;
}

type Props = { isInsider: boolean; html: string };

describe('useTaskCheckboxes', () => {
  let el: HTMLElement;
  const useProbe = ({ isInsider, html }: Props) =>
    useTaskCheckboxes({ current: el }, html, isInsider, 'j/a.md');

  beforeEach(() => {
    vi.clearAllMocks();
    server.fileMutate.mockResolvedValue({ ok: true });
    el = article();
  });

  const boxes = () =>
    Array.from(el.querySelectorAll<HTMLInputElement>('input'));

  it('enables task checkboxes for an insider and sends a toggle as a mutation', async () => {
    const hook = await renderHook(useProbe, { isInsider: true, html: 'a' });
    const [first, second, plain] = boxes();
    expect(first!.hasAttribute('disabled')).toBe(false);
    expect(second!.style.cursor).toBe('pointer');
    expect(plain!.style.cursor).toBe('');

    second!.checked = true;
    second!.dispatchEvent(new Event('change', { bubbles: true }));
    expect(server.fileMutate).toHaveBeenCalledExactlyOnceWith({
      '*': 'j/a.md',
      action: 'toggle-checkbox',
      index: 1,
      checked: true,
    });
    // A checkbox without an index is not a task checkbox.
    plain!.dispatchEvent(new Event('change', { bubbles: true }));
    expect(server.fileMutate).toHaveBeenCalledOnce();
    await hook.unmount();
  });

  it('keeps them disabled for others and sends nothing', async () => {
    const hook = await renderHook(useProbe, { isInsider: false, html: 'a' });
    const [first] = boxes();
    expect(first!.hasAttribute('disabled')).toBe(true);
    first!.dispatchEvent(new Event('change', { bubbles: true }));
    expect(server.fileMutate).not.toHaveBeenCalled();
    await hook.unmount();
  });

  it('re-applies to new HTML', async () => {
    const hook = await renderHook(useProbe, { isInsider: true, html: 'a' });
    el.innerHTML = '<input type="checkbox" data-checkbox-index="0" disabled>';
    await hook.rerender({ isInsider: true, html: 'b' });
    expect(boxes()[0]!.hasAttribute('disabled')).toBe(false);
    await hook.unmount();
  });

  it('warns when a toggle fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    server.fileMutate.mockRejectedValue(new Error('down'));
    const hook = await renderHook(useProbe, { isInsider: true, html: 'a' });
    boxes()[0]!.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith('Checkbox toggle failed for index', 0),
    );
    warn.mockRestore();
    await hook.unmount();
  });
});
