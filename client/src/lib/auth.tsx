import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { getAuthStatus, rotateKey as apiRotateKey } from './api';

interface AuthState {
  loading: boolean;
  authenticated: boolean;
  email?: string;
  picture?: string;
  isInsider: boolean;
  keyCreatedAt?: string | null;
  rotateKey: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  loading: true,
  authenticated: false,
  isInsider: false,
  rotateKey: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState<string | undefined>();
  const [picture, setPicture] = useState<string | undefined>();
  const [isInsider, setIsInsider] = useState(false);
  const [keyCreatedAt, setKeyCreatedAt] = useState<string | null | undefined>();

  useEffect(() => {
    getAuthStatus()
      .then((status) => {
        setAuthenticated(status.authenticated);
        setEmail(status.email);
        setPicture(status.picture);
        setIsInsider(status.isInsider);
        setKeyCreatedAt(status.keyCreatedAt);
      })
      .catch(() => {
        setAuthenticated(false);
      })
      .finally(() => setLoading(false));
  }, []);

  const rotateKey = useCallback(async () => {
    const result = await apiRotateKey();
    if (result.ok && result.keyCreatedAt) {
      setKeyCreatedAt(result.keyCreatedAt);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ loading, authenticated, email, picture, isInsider, keyCreatedAt, rotateKey }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
