/**
 * The tab bar's Undo and Redo buttons for a file (each shown when available, a spinner while a write is in flight).
 */
import { Loader2, Redo2, Undo2 } from 'lucide-react';

interface UndoRedoControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  saving: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

const BUTTON =
  'p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50';

export function UndoRedoControls({
  canUndo,
  canRedo,
  saving,
  onUndo,
  onRedo,
}: UndoRedoControlsProps) {
  return (
    <div className="flex items-center gap-0.5 ml-2">
      {canUndo && (
        <button
          onClick={onUndo}
          disabled={saving}
          title="Undo (Ctrl+Z)"
          className={BUTTON}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Undo2 className="h-4 w-4" />
          )}
        </button>
      )}
      {canRedo && (
        <button
          onClick={onRedo}
          disabled={saving}
          title="Redo (Ctrl+Shift+Z)"
          className={BUTTON}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Redo2 className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  );
}
