import { beforeEach, describe, expect, it } from 'vitest';

import { renderHook, settle } from '@/test/reactHarness';

import { useBlockHover } from './useBlockHover';

/** Past the hover debounce. */
const DEBOUNCE = 250;

type Props = { html: string; disabled: boolean };

describe('useBlockHover', () => {
  let container: HTMLElement;
  const useProbe = ({ html, disabled }: Props) =>
    useBlockHover({ current: container }, html, disabled);

  beforeEach(() => {
    container = document.createElement('div');
    container.innerHTML =
      '<p data-source-start="1" data-source-end="1"><em>x</em></p><span>plain</span>';
    document.body.append(container);
  });

  const over = (el: Element) =>
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  const out = (el: Element, relatedTarget: Element | null) =>
    el.dispatchEvent(
      new MouseEvent('mouseout', { bubbles: true, relatedTarget }),
    );

  it('hovers the mapped block under the pointer after the debounce, with its rectangle', async () => {
    const hook = await renderHook(useProbe, { html: 'a', disabled: false });
    const p = container.querySelector('p')!;
    await settle(() => over(container.querySelector('em')!));
    expect(hook.result.current?.hoveredEl).toBeNull();
    await settle(undefined, DEBOUNCE);
    expect(hook.result.current?.hoveredEl).toBe(p);
    expect(hook.result.current?.hoverRect).toMatchObject({ width: 12 });
    await hook.unmount();
  });

  it('clears on leaving the container or moving onto unmapped content, not onto the controls', async () => {
    const hook = await renderHook(useProbe, { html: 'a', disabled: false });
    const p = container.querySelector('p')!;
    const controls = document.createElement('div');
    container.append(controls);
    hook.result.current!.controlsRef.current = controls;
    await settle(() => over(p), DEBOUNCE);

    await settle(() => out(p, controls), DEBOUNCE);
    expect(hook.result.current?.hoveredEl).toBe(p);

    await settle(() => out(p, container.querySelector('span')), DEBOUNCE);
    expect(hook.result.current?.hoveredEl).toBeNull();

    await settle(() => over(p), DEBOUNCE);
    await settle(() => out(p, document.body), DEBOUNCE);
    expect(hook.result.current?.hoveredEl).toBeNull();

    await settle(() => over(p), DEBOUNCE);
    await settle(() => out(p, null), DEBOUNCE);
    expect(hook.result.current?.hoverRect).toBeNull();
    await hook.unmount();
  });

  it('clears when the HTML changes, and on clearHover', async () => {
    const hook = await renderHook(useProbe, { html: 'a', disabled: false });
    const p = container.querySelector('p')!;
    await settle(() => over(p), DEBOUNCE);
    await hook.rerender({ html: 'b', disabled: false });
    expect(hook.result.current?.hoveredEl).toBeNull();

    await settle(() => over(p), DEBOUNCE);
    await settle(() => hook.result.current!.clearHover());
    expect(hook.result.current?.hoveredEl).toBeNull();
    await hook.unmount();
  });

  it('tracks nothing when disabled', async () => {
    const hook = await renderHook(useProbe, { html: 'a', disabled: true });
    await settle(() => over(container.querySelector('p')!), DEBOUNCE);
    expect(hook.result.current?.hoveredEl).toBeNull();
    await hook.unmount();
  });
});
