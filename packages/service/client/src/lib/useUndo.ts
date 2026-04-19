import { useContext } from 'react';

import { UndoContext } from '@/lib/undoState';
import type { UndoState } from '@/lib/undoState';

export function useUndo(): UndoState {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error('useUndo must be used within UndoProvider');
  return ctx;
}
