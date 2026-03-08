/**
 * Hook for managing action dropdown state machine.
 */
import { useState } from 'react';

import type { ActionState } from './ActionDropdown';

export function useActionState(
  onError?: (error: string) => void,
  onStateChange?: (state: ActionState) => void,
) {
  const [state, setStateInternal] = useState<ActionState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const setState = (s: ActionState) => {
    setStateInternal(s);
    onStateChange?.(s);
  };

  const handleAction = async (action: () => Promise<void>) => {
    setState('loading');
    setErrorMsg(null);
    try {
      await action();
      setState('done');
      setTimeout(() => setState('idle'), 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      setErrorMsg(msg);
      setState('error');
      onError?.(msg);
    }
  };

  const resetOnClose = (open: boolean) => {
    if (!open && state === 'error') {
      setState('idle');
      setErrorMsg(null);
    }
  };

  return { state, errorMsg, handleAction, resetOnClose };
}
