/**
 * Auth status API route.
 *
 * Handler: `authStatus` (GET /api/auth/status).
 *
 * A `public` entry: the access hook resolves the caller's session (never
 * failing the request), which this route reports; otherwise a key in `k` is
 * checked against the `path` query, as a share link opening that path.
 *
 * @packageDocumentation
 */

import { getUrlKey } from '@karmaniverous/jeeves-server-core';

import { type HandlersFor, ok } from '../../api/handlerTypes.js';
import {
  type AuthQuery,
  extractDeepParams,
  findInsider,
  resolveKeyAuth,
} from '../../auth/resolve.js';
import { getConfig } from '../../config/index.js';

/** `authStatus`: who the caller is (session, or a key for `path`). */
export const authStatusHandlers: HandlersFor<'authStatus'> = {
  authStatus: (_input, request) => {
    const config = getConfig();

    // The session the access hook resolved
    const identity = request.access?.identity;
    if (identity?.kind === 'session') {
      const insider = findInsider(config.resolvedInsiders, identity.name);
      // Get picture from session cookie directly
      const cookieValue = (
        request.cookies as Record<string, string> | undefined
      )?.['jeeves_session'];
      let picture: string | undefined;
      if (cookieValue) {
        try {
          const b64 = cookieValue.slice(0, cookieValue.lastIndexOf('.'));
          const payload = JSON.parse(
            Buffer.from(b64, 'base64url').toString(),
          ) as { picture?: string };
          picture = payload.picture;
        } catch {
          /* ignore */
        }
      }

      return Promise.resolve(
        ok({
          authenticated: true as const,
          email: identity.name,
          picture,
          isInsider: !!insider?.seed,
          keyCreatedAt: insider?.keyCreatedAt ?? null,
          searchEnabled: true,
        }),
      );
    }

    // Try key-based auth
    if (config.authModes.includes('keys')) {
      // The raw query the access hook kept: the validated one has no
      // credentials.
      const query: AuthQuery & { path?: string } =
        request.credentialQuery ?? {};
      const deepParams = extractDeepParams(query);

      const keyResult = resolveKeyAuth(
        config,
        query.path ?? '/',
        getUrlKey(query),
        query.exp,
        deepParams,
      );
      if (keyResult.valid) {
        return Promise.resolve(
          ok({
            authenticated: true as const,
            email: `key:${String(keyResult.keyName)}`,
            isInsider: keyResult.mode === 'insider',
            keyCreatedAt: null,
          }),
        );
      }
    }

    return Promise.resolve(
      ok({ authenticated: false as const, isInsider: false }),
    );
  },
};
