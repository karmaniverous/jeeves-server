/**
 * Minimal React harness for client tests (happy-dom): mounts an element or
 * a hook probe inside React's `act`, letting pending promises settle, and
 * re-renders or unmounts it the same way.
 */
import {
  act,
  createElement,
  type FunctionComponent,
  type ReactElement,
  useEffect,
} from 'react';
import { createRoot } from 'react-dom/client';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Run `fn` inside `act`, then let queued promises and timers settle,
 * waiting `ms` milliseconds more (e.g. for a debounce to elapse).
 */
export const settle = (
  fn: () => void = () => undefined,
  ms = 0,
): Promise<void> =>
  act(async () => {
    fn();
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

/** A mounted element: re-render it with a new element, or unmount it. */
interface Mounted {
  rerender: (element: ReactElement) => Promise<void>;
  unmount: () => Promise<void>;
}

/**
 * Mount `element` in a detached container.
 *
 * @param element - What to render.
 * @returns Re-render and unmount handles.
 */
async function mount(element: ReactElement): Promise<Mounted> {
  const root = createRoot(document.createElement('div'));
  const rerender = (next: ReactElement) =>
    settle(() => {
      root.render(next);
    });
  await rerender(element);
  return {
    rerender,
    unmount: () =>
      settle(() => {
        root.unmount();
      }),
  };
}

/** A mounted component: re-render it with new props, or unmount it. */
export interface MountedComponent<P> {
  rerender: (props: P) => Promise<void>;
  unmount: () => Promise<void>;
}

/**
 * Mount `component` with `props`.
 *
 * @param component - The component under test.
 * @param props - Initial props.
 * @returns Re-render (with new props) and unmount handles.
 */
export async function mountComponent<P extends object>(
  component: FunctionComponent<P>,
  props: P,
): Promise<MountedComponent<P>> {
  const mounted = await mount(createElement(component, props));
  return {
    rerender: (next: P) => mounted.rerender(createElement(component, next)),
    unmount: mounted.unmount,
  };
}

/** A rendered hook: its latest result, a re-render and an unmount. */
export interface RenderedHook<P, R> {
  result: { current: R | undefined };
  rerender: (props: P) => Promise<void>;
  unmount: () => Promise<void>;
}

/**
 * Render `useHook` with `props` inside a probe component.
 *
 * @param useHook - The hook under test, called with the props.
 * @param props - Initial props.
 * @returns The rendered hook.
 */
export async function renderHook<P, R>(
  useHook: (props: P) => R,
  props: P,
): Promise<RenderedHook<P, R>> {
  const result: { current: R | undefined } = { current: undefined };
  function Probe({ hookProps }: { hookProps: P }) {
    const value = useHook(hookProps);
    useEffect(() => {
      result.current = value;
    });
    return null;
  }
  const probe = (hookProps: P) => createElement(Probe, { hookProps });
  const mounted = await mount(probe(props));
  return {
    result,
    rerender: (next: P) => mounted.rerender(probe(next)),
    unmount: mounted.unmount,
  };
}
