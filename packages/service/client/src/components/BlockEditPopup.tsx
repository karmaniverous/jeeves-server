/**
 * Modal popup for editing Markdown blocks or table cells inline.
 */
import { lazy, Suspense, useCallback } from 'react';
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

  /** Unified save handler for all edit modes. */
  const handleSave = useCallback(
    async (content: string) => {
      try {
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
        } else if (mode.kind === 'edit-cell') {
          await fileMutate(reqPath, {
            action: 'edit-cell',
            line: mode.line,
            col: mode.col,
            content,
          });
        }
        pushUndo(reqPath, fileContent);
        onSaved();
      } catch (e: unknown) {
        onError((e as Error).message);
      }
    },
    [mode, reqPath, fileContent, pushUndo, onSaved, onError],
  );

  const initialContent = mode.content ?? '';
  const language = mode.kind === 'edit-cell' ? 'md' : mode.language;
  const title = mode.kind === 'edit-block'
    ? `Edit ${capitalize(blockLabel)}`
    : mode.kind === 'edit-cell'
      ? 'Edit Cell'
      : `Insert ${capitalize(mode.position)} ${capitalize(blockLabel)}`;


  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div className="bg-popover border border-border rounded-lg shadow-lg w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/50">
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
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
              onSave={handleSave}
              onCancel={onClose}
              saveShortcut="ctrl-enter"
              showToolbar
              autoFocus
              lineWrapping
              contained
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
