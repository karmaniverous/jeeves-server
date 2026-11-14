import { describe, expect, it, vi } from 'vitest';

import { mountComponent, settle } from '@/test/reactHarness';

interface Binding {
  key: string;
  run: () => boolean;
}

// A stand-in for the CodeMirror modules: records views and key bindings.
const cm = vi.hoisted(() => {
  const views: { doc: string; focused: boolean; destroyed: boolean }[] = [];
  const keymaps: Binding[][] = [];
  class EditorView {
    static theme = () => ({});
    static updateListener = { of: () => ({}) };
    static lineWrapping = {};
    record: (typeof views)[number];
    state: { doc: { toString: () => string } };
    constructor({ state }: { state: { doc: { toString: () => string } } }) {
      this.state = state;
      this.record = {
        doc: state.doc.toString(),
        focused: false,
        destroyed: false,
      };
      views.push(this.record);
    }
    focus() {
      this.record.focused = true;
    }
    destroy() {
      this.record.destroyed = true;
    }
  }
  const module = {
    EditorView,
    EditorState: {
      create: ({ doc }: { doc: string }) => ({ doc: { toString: () => doc } }),
    },
    Prec: { highest: (x: unknown) => x },
    basicSetup: {},
    keymap: {
      of: (bindings: Binding[]) => {
        keymaps.push(bindings);
        return {};
      },
    },
    oneDark: {},
  };
  return { views, keymaps, module };
});

vi.mock('@/lib/codemirror', () => ({
  loadCodeMirror: () => Promise.resolve(cm.module),
  getLanguageExtension: () => Promise.resolve(null),
}));
vi.mock('@/lib/theme', () => ({ useTheme: () => ['light'] }));

const { CodeEditor } = await import('./CodeEditor');

const binding = (key: string) => cm.keymaps.at(-1)?.find((b) => b.key === key);

describe('CodeEditor', () => {
  it('builds the editor once and keys call the latest handlers', async () => {
    const firstSave = vi.fn(() => Promise.resolve());
    const firstCancel = vi.fn();
    const mounted = await mountComponent(CodeEditor, {
      content: 'initial',
      fileName: 'a.md',
      onSave: firstSave,
      onCancel: firstCancel,
      autoFocus: true,
    });
    expect(cm.views).toHaveLength(1);
    expect(cm.views[0]).toMatchObject({ doc: 'initial', focused: true });

    const latestSave = vi.fn(() => Promise.resolve());
    const latestCancel = vi.fn();
    await mounted.rerender({
      content: 'changed',
      fileName: 'b.md',
      onSave: latestSave,
      onCancel: latestCancel,
      autoFocus: true,
    });
    // New props don't rebuild the editor or replace its document.
    expect(cm.views).toHaveLength(1);

    await settle(() => binding('Mod-s')?.run());
    expect(latestSave).toHaveBeenCalledExactlyOnceWith('initial');
    expect(firstSave).not.toHaveBeenCalled();

    binding('Escape')?.run();
    expect(latestCancel).toHaveBeenCalledOnce();
    expect(firstCancel).not.toHaveBeenCalled();

    await mounted.unmount();
    expect(cm.views[0].destroyed).toBe(true);
  });

  it('binds Ctrl+Enter and no Escape when mounted without a cancel handler', async () => {
    const mounted = await mountComponent(CodeEditor, {
      content: 'x',
      fileName: 'note.txt',
      onSave: () => Promise.resolve(),
      saveShortcut: 'ctrl-enter',
    });
    expect(binding('Mod-Enter')).toBeDefined();
    expect(binding('Mod-s')).toBeUndefined();
    expect(binding('Escape')).toBeUndefined();
    expect(cm.views.at(-1)?.focused).toBe(false);
    await mounted.unmount();
  });
});
