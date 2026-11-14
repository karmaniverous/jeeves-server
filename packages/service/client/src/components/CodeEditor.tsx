/**
 * Lazy-loaded CodeMirror editor for in-browser text editing.
 * Only imported when the user clicks Edit on a text file's Raw tab.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useLatestRef } from '@/hooks/useLatestRef';
import { getLanguageExtension, loadCodeMirror } from '@/lib/codemirror';
import { useTheme } from '@/lib/theme';

interface CodeEditorProps {
  content: string;
  fileName: string;
  onSave: (content: string) => Promise<void>;
  onCancel?: () => void;
  /** Keyboard shortcut for save. Default: 'ctrl-s'. */
  saveShortcut?: 'ctrl-s' | 'ctrl-enter';
  /** Whether to show the toolbar. Default: true. */
  showToolbar?: boolean;
  /** Whether to focus the editor on mount. Default: false. */
  autoFocus?: boolean;
  /** Whether to enable soft line wrapping. Default: false. */
  lineWrapping?: boolean;
  /** Whether to constrain the editor to its container via absolute positioning. Default: false. */
  contained?: boolean;
}

export function CodeEditor({
  content,
  fileName,
  onSave,
  onCancel,
  saveShortcut = 'ctrl-s',
  showToolbar = true,
  autoFocus = false,
  lineWrapping = false,
  contained = false,
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<import('@codemirror/view').EditorView | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [theme] = useTheme();
  const savedContentRef = useRef(content);

  const handleSave = useCallback(async () => {
    if (!viewRef.current) return;
    const newContent = viewRef.current.state.doc.toString();
    setSaving(true);
    try {
      await onSave(newContent);
      savedContentRef.current = newContent;
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  // The editor is built once, from the props it mounted with; its key
  // bindings call the latest save and cancel handlers through refs.
  const [initial] = useState(() => ({
    content,
    fileName,
    saveShortcut,
    hasCancel: onCancel !== undefined,
    autoFocus,
    lineWrapping,
    theme,
  }));
  const handleSaveRef = useLatestRef(handleSave);
  const onCancelRef = useLatestRef(onCancel);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let destroyed = false;

    (async () => {
      const { EditorView, EditorState, Prec, basicSetup, keymap, oneDark } =
        await loadCodeMirror();
      if (destroyed) return;

      const ext = initial.fileName.split('.').pop() ?? '';
      const langExt = await getLanguageExtension(ext);
      if (destroyed) return;

      const keybindings: { key: string; run: () => boolean }[] = [
        {
          key: initial.saveShortcut === 'ctrl-enter' ? 'Mod-Enter' : 'Mod-s',
          run: () => {
            void handleSaveRef.current();
            return true;
          },
        },
      ];
      if (initial.hasCancel) {
        keybindings.push({
          key: 'Escape',
          run: () => {
            onCancelRef.current?.();
            return true;
          },
        });
      }

      const extensions = [
        basicSetup,
        Prec.highest(keymap.of(keybindings)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const current = update.state.doc.toString();
            setDirty(current !== savedContentRef.current);
          }
        }),
        EditorView.theme({
          '&': { fontSize: '14px', flex: '1 1 0%', minHeight: '0' },
          '.cm-scroller': { overflow: 'auto' },
          '.cm-content': {
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          },
          '.cm-gutters': {
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          },
        }),
      ];

      if (initial.lineWrapping) {
        extensions.push(EditorView.lineWrapping);
      }

      if (initial.theme === 'dark') {
        extensions.push(oneDark);
      }

      if (langExt) {
        extensions.push(langExt);
      }

      const state = EditorState.create({
        doc: initial.content,
        extensions,
      });

      const view = new EditorView({ state, parent: container });

      viewRef.current = view;
      if (initial.autoFocus) view.focus();
      setLoading(false);
    })();

    return () => {
      destroyed = true;
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [initial, handleSaveRef, onCancelRef]);

  return (
    <div
      className={`flex flex-col overflow-hidden ${contained ? 'flex-1 min-h-0' : 'h-full'}`}
    >
      {/* Toolbar */}
      {showToolbar && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/50">
          <span className="text-sm font-medium text-foreground">Editing</span>
          {dirty && (
            <span className="text-xs px-1.5 py-0.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded">
              unsaved
            </span>
          )}
          <div className="flex-1" />
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1 text-sm rounded border border-border text-muted-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {saveShortcut === 'ctrl-enter' ? 'Ctrl+Enter' : 'Ctrl+S'}
          </span>
        </div>
      )}

      {/* Editor */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-hidden flex flex-col"
      >
        {loading && (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Loading editor…
          </div>
        )}
      </div>
    </div>
  );
}
