/**
 * Auth status provider component.
 *
 * Fetches /api/auth/status once on mount to populate display-level auth
 * state (email, picture, isInsider). No auth gating — the server-side gate
 * (#253) guarantees authentication before the SPA loads.
 */
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { AuthStatusContext } from './AuthStatusContext';
import { client, server } from './server';

export function AuthStatusProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | undefined>();
  const [picture, setPicture] = useState<string | undefined>();
  const [isInsider, setIsInsider] = useState(false);
  const [keyCreatedAt, setKeyCreatedAt] = useState<string | null | undefined>();
  const [searchEnabled, setSearchEnabled] = useState(false);

  useEffect(() => {
    const browsePath = window.location.pathname.replace(/^\/browse/, '') || '/';
    // `client`, not `server`: no credential is a status, not a sign-in.
    client
      .authStatus({ path: browsePath })
      .then((status) => {
        setEmail(status.email);
        setPicture(status.picture);
        setIsInsider(status.isInsider);
        setSearchEnabled(!!status.searchEnabled);
        setKeyCreatedAt(status.keyCreatedAt);
      })
      .catch(() => {});
  }, []);

  const rotateKey = useCallback(async () => {
    const result = await server.rotateKey();
    setKeyCreatedAt(result.keyCreatedAt);
  }, []);

  return (
    <AuthStatusContext.Provider
      value={{
        email,
        picture,
        isInsider,
        searchEnabled,
        keyCreatedAt,
        rotateKey,
      }}
    >
      {children}
    </AuthStatusContext.Provider>
  );
}
