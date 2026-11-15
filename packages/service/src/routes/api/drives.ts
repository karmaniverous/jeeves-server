/**
 * Drive listing API route.
 *
 * Handles: GET /api/drives
 *
 * Scoped insiders only see roots they can navigate into.
 */

import { type HandlersFor, ok } from '../../api/handlerTypes.js';
import { canNavigatePath } from '../../auth/scopeAccess.js';
import { getConfig } from '../../config/index.js';
import { getRoots } from '../../util/platform.js';

/** `drives`: the roots the caller's scopes can navigate. */
export const drivesHandlers: HandlersFor<'drives'> = {
  drives: (_input, request) => {
    const scopes = request.insiderScopes ?? null;
    return Promise.resolve(
      ok(
        getRoots(getConfig().roots)
          .filter((r) => canNavigatePath(`/${r.id}`, scopes))
          .map((r) => ({ letter: r.id, label: r.label })),
      ),
    );
  },
};
