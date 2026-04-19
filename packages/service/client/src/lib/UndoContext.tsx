import { useCallback, useRef, type ReactNode } from 'react';

import { UndoContext } from '@/lib/undoState';

const MAX_DEPTH = 20;

export function UndoProvider({ children }: { children: ReactNode }) {
  const undoStackRef = useRef(new Map<string, string[]>());
  const redoStackRef = useRef(new Map<string, string[]>());

  const pushUndo = useCallback((filePath: string, content: string) => {
    const stack = undoStackRef.current.get(filePath) ?? [];
    stack.push(content);
    if (stack.length > MAX_DEPTH) stack.shift();
    undoStackRef.current.set(filePath, stack);
    redoStackRef.current.delete(filePath);
  }, []);

  const undo = useCallback((filePath: string, currentContent: string): string | undefined => {
    const stack = undoStackRef.current.get(filePath);
    if (!stack || stack.length === 0) return undefined;
    const prev = stack.pop()!;
    const redoStack = redoStackRef.current.get(filePath) ?? [];
    redoStack.push(currentContent);
    redoStackRef.current.set(filePath, redoStack);
    return prev;
  }, []);

  const redo = useCallback((filePath: string, currentContent: string): string | undefined => {
    const stack = redoStackRef.current.get(filePath);
    if (!stack || stack.length === 0) return undefined;
    const next = stack.pop()!;
    const undoStack = undoStackRef.current.get(filePath) ?? [];
    undoStack.push(currentContent);
    undoStackRef.current.set(filePath, undoStack);
    return next;
  }, []);

  const canUndo = useCallback((filePath: string): boolean => {
    const stack = undoStackRef.current.get(filePath);
    return !!stack && stack.length > 0;
  }, []);

  const canRedo = useCallback((filePath: string): boolean => {
    const stack = redoStackRef.current.get(filePath);
    return !!stack && stack.length > 0;
  }, []);

  return (
    <UndoContext.Provider value={{ pushUndo, undo, redo, canUndo, canRedo }}>
      {children}
    </UndoContext.Provider>
  );
}
