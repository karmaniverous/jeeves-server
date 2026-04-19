import { createContext } from 'react';

export interface UndoState {
  pushUndo: (filePath: string, content: string) => void;
  peekUndo: (filePath: string) => string | undefined;
  peekRedo: (filePath: string) => string | undefined;
  confirmUndo: (filePath: string, currentContent: string) => void;
  confirmRedo: (filePath: string, currentContent: string) => void;
  canUndo: (filePath: string) => boolean;
  canRedo: (filePath: string) => boolean;
  /** Incremented on every stack mutation to trigger consumer re-renders. */
  version: number;
}

export const UndoContext = createContext<UndoState | null>(null);
