import { createContext } from 'react';

export interface UndoState {
  pushUndo: (filePath: string, content: string) => void;
  undo: (filePath: string, currentContent: string) => string | undefined;
  redo: (filePath: string, currentContent: string) => string | undefined;
  canUndo: (filePath: string) => boolean;
  canRedo: (filePath: string) => boolean;
}

export const UndoContext = createContext<UndoState | null>(null);
