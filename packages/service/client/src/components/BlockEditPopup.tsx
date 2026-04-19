/**
 * Modal popup for editing Markdown blocks or table cells inline.
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { fileMutate } from '@/lib/api';
import { useUndo } from '@/lib/useUndo';

const CodeEditor = lazy(() =>
  import('@/components/CodeEditor').then((m) => ({ default: m.CodeEditor })),
);

export type BlockEditMode =
  | { kind: 'edit-block'; startLine: number; endLine: number; content: string; language: string }
  | { kind: 'insert-block'; atLine: number; position: 'before' | 'after'; language: string; content?: string; context?: 'table-row' }
  | { kind: 'edit-cell'; line: number; col: number; content: string };

interface BlockEditPopupProps {
  mode: BlockEditMode;
  reqPath: string;
  blockLabel: string;
  fileContent: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}

/** Capitalize the first letter of each word. */
function capitalize(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function BlockEditPopup({ mode, reqPath, blockLabel, fileContent, onClose, onSaved, onError }: BlockEditPopupProps) {
  const { pushUndo } = useUndo();
  const [cellValue, setCellValue] = useState(mode.kind === 'edit-cell' ? mode.content : '');
  const [cellSaving, setCellSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (mode.kind === 'edit-cell' && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [mode.kind]);

  const handleCellSave = useCallback(async () => {
    if (mode.kind !== 'edit-cell') return;
    setCellSaving(true);
    try {
      pushUndo(reqPath, fileContent);
      await fileMutate(reqPath, {
        action: 'edit-cell',
        line: mode.line,
        col: mode.col,
        content: cellValue,
      });
      onSaved();
    } catch (e: unknown) {
      onError((e as Error).message);
    } finally {
      setCellSaving(false);
    }
  }, [mode, reqPath, cellValue, fileContent, pushUndo, onSaved, onError]);

  const handleBlockSave = useCallback(
    async (content: string) => {
      pushUndo(reqPath, fileContent);
      if (mode.kind === 'edit-block') {
        await fileMutate(reqPath, {
          action: 'edit-block',
          startLine: mode.startLine,
          endLine: mode.endLine,
          content: content + '\n',
        });
      } else if (mode.kind === 'insert-block') {
        await fileMutate(reqPath, {
          action: 'insert-block',
          atLine: mode.atLine,
          position: mode.position,
          content: content + '\n',
          ...(mode.context ? { context: mode.context } : {}),
        });
      }
      onSaved();
    },
    [mode, reqPath, fileContent, pushUndo, onSaved],
  );

  // Cell editing: simple input
  if (mode.kind === 'edit-cell') {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      >
        <div className="bg-popover border border-border rounded-lg shadow-lg p-4 w-full max-w-md">
          <div className="text-sm font-medium text-foreground mb-2">Edit Cell</div>
          <textarea
            ref={textareaRef}
            value={cellValue}
            onChange={(e) => setCellValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleCellSave(); }
              if (e.key === 'Escape') onClose();
            }}
            rows={Math.max(2, Math.min(10, cellValue.split('\n').length))}
            className="w-full px-3 py-2 border border-border rounded bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={cellSaving}
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={onClose}
              className="px-3 py-1 text-sm rounded border border-border text-muted-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCellSave}
              disabled={cellSaving}
              className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {cellSaving ? 'Saving…' : 'Save'}
            </button>
            <span className="text-xs text-muted-foreground self-center">Ctrl+Enter to save</span>
          </div>
        </div>
      </div>
    );
  }

  // Block editing: CodeEditor
  const initialContent = mode.kind === 'edit-block' ? mode.content : (mode.content ?? '');
  const language = mode.language;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div className="bg-popover border border-border rounded-lg shadow-lg w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/50">
          <span className="text-sm font-medium text-foreground">
            {mode.kind === 'edit-block'
              ? `Edit ${capitalize(blockLabel)}`
              : `Insert ${capitalize(mode.position)} ${capitalize(blockLabel)}`}
          </span>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-3 py-1 text-sm rounded border border-border text-muted-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <span className="text-xs text-muted-foreground">Esc</span>
        </div>
        <div className="flex-1 min-h-[200px] overflow-hidden">
          <Suspense
            fallback={
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading editor…
              </div>
            }
          >
            <CodeEditor
              content={initialContent}
              fileName={`block.${language}`}
              onSave={handleBlockSave}
              onCancel={onClose}
              saveShortcut="ctrl-enter"
              showToolbar={false}
              autoFocus
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
