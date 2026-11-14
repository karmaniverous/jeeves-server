import { describe, expect, it, vi } from 'vitest';

import { renderHook, settle } from '@/test/reactHarness';

import { useOutsideClick } from './useOutsideClick';

type Props = { active: boolean; onOutside: () => void; capture?: boolean };

const inside = document.createElement('div');
const child = document.createElement('span');
inside.append(child);
const outside = document.createElement('div');
document.body.append(inside, outside);

const ref = { current: inside };

const mouseDown = (target: Element) =>
  settle(() => {
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  });

describe('useOutsideClick', () => {
  it.each([false, true])(
    'calls back on outside mouse-downs only while active (capture %s)',
    async (capture) => {
      const onOutside = vi.fn();
      const hook = await renderHook(
        (p: Props) => {
          useOutsideClick(ref, p.active, p.onOutside, p.capture);
        },
        { active: false, onOutside, capture },
      );
      await mouseDown(outside);
      expect(onOutside).not.toHaveBeenCalled();

      await hook.rerender({ active: true, onOutside, capture });
      await mouseDown(child);
      await mouseDown(inside);
      expect(onOutside).not.toHaveBeenCalled();
      await mouseDown(outside);
      expect(onOutside).toHaveBeenCalledOnce();

      // The latest callback is called without re-subscribing.
      const latest = vi.fn();
      await hook.rerender({ active: true, onOutside: latest, capture });
      await mouseDown(outside);
      expect(latest).toHaveBeenCalledOnce();
      expect(onOutside).toHaveBeenCalledOnce();

      // Unmounting stops listening.
      await hook.unmount();
      await mouseDown(outside);
      expect(latest).toHaveBeenCalledOnce();
    },
  );
});
