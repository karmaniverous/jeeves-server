/**
 * Auth status context and hook — display state only, no gating.
 *
 * Since the server-side auth gate (#253) guarantees authentication before the
 * SPA loads, this context only provides display-level information (email,
 * picture, isInsider flags, key rotation).
 */
import { createContext, useContext } from 'react';

/** Auth status state exposed to consumers. */
export interface AuthStatusState {
  email?: string;
  picture?: string;
  isInsider: boolean;
  searchEnabled: boolean;
  keyCreatedAt?: string | null;
  rotateKey: () => Promise<void>;
}

export const AuthStatusContext = createContext<AuthStatusState>({
  isInsider: false,
  searchEnabled: false,
  rotateKey: async () => {},
});

/** Returns auth display state for the current user. */
export function useAuthStatus(): AuthStatusState {
  return useContext(AuthStatusContext);
}
