/**
 * Auth provider component.
 */
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { getAuthStatus, rotateKey as apiRotateKey } from './api';
import { AuthContext } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState<string | undefined>();
  const [picture, setPicture] = useState<string | undefined>();
  const [isInsider, setIsInsider] = useState(false);
  const [keyCreatedAt, setKeyCreatedAt] = useState<string | null | undefined>();
  const [searchEnabled, setSearchEnabled] = useState(false);

  useEffect(() => {
    const browsePath = window.location.pathname.replace(/^\/browse/, '') || '/';
    getAuthStatus(browsePath)
      .then((status) => {
        setAuthenticated(status.authenticated);
        setEmail(status.email);
        setPicture(status.picture);
        setIsInsider(status.isInsider);
        setSearchEnabled(!!status.searchEnabled);
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
      value={{ loading, authenticated, email, picture, isInsider, searchEnabled, keyCreatedAt, rotateKey }}
    >
      {children}
    </AuthContext.Provider>
  );
}
