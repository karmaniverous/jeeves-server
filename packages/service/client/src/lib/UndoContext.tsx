import { useCallback, useRef, useState, type ReactNode } from 'react';

import { UndoContext } from '@/lib/undoState';

const MAX_DEPTH = 20;

export function UndoProvider({ children }: { children: ReactNode }) {
  const undoStackRef = useRef(new Map<string, string[]>());
  const redoStackRef = useRef(new Map<string, string[]>());
  const [version, setVersion] = useState(0);

  const pushUndo = useCallback((filePath: string, content: string) => {
    const stack = undoStackRef.current.get(filePath) ?? [];
    stack.push(content);
    if (stack.length > MAX_DEPTH) stack.shift();
    undoStackRef.current.set(filePath, stack);
    redoStackRef.current.delete(filePath);
    setVersion((v) => v + 1);
  }, []);

  const peekUndo = useCallback((filePath: string): string | undefined => {
    const stack = undoStackRef.current.get(filePath);
    if (!stack || stack.length === 0) return undefined;
    return stack[stack.length - 1];
  }, []);

  const peekRedo = useCallback((filePath: string): string | undefined => {
    const stack = redoStackRef.current.get(filePath);
    if (!stack || stack.length === 0) return undefined;
    return stack[stack.length - 1];
  }, []);

  const confirmUndo = useCallback((filePath: string, currentContent: string) => {
    const stack = undoStackRef.current.get(filePath);
    if (!stack || stack.length === 0) return;
    stack.pop();
    const redoStack = redoStackRef.current.get(filePath) ?? [];
    redoStack.push(currentContent);
    redoStackRef.current.set(filePath, redoStack);
    setVersion((v) => v + 1);
  }, []);

  const confirmRedo = useCallback((filePath: string, currentContent: string) => {
    const stack = redoStackRef.current.get(filePath);
    if (!stack || stack.length === 0) return;
    stack.pop();
    const undoStack = undoStackRef.current.get(filePath) ?? [];
    undoStack.push(currentContent);
    undoStackRef.current.set(filePath, undoStack);
    setVersion((v) => v + 1);
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
    <UndoContext.Provider value={{ pushUndo, peekUndo, peekRedo, confirmUndo, confirmRedo, canUndo, canRedo, version }}>
      {children}
    </UndoContext.Provider>
  );
}
