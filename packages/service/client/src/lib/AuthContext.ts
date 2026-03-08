/**
 * Auth context and hook.
 */
import { createContext, useContext } from 'react';

export interface AuthState {
  loading: boolean;
  authenticated: boolean;
  email?: string;
  picture?: string;
  isInsider: boolean;
  searchEnabled: boolean;
  keyCreatedAt?: string | null;
  rotateKey: () => Promise<void>;
}

export const AuthContext = createContext<AuthState>({
  loading: true,
  authenticated: false,
  isInsider: false,
  searchEnabled: false,
  rotateKey: async () => {},
});

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
