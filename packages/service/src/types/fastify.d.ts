import type { ServerEntryName } from '@karmaniverous/jeeves-server-core';

import type { AccessClass } from '../api/routeAccess.js';
import type { Identity } from '../auth/credentials.js';
import type { AccessMode, NormalizedScopes } from '../config/types.js';

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * What the access hook resolved for a catalog route: the entry, its
     * access class, the caller's identity and, on the key-exchange and
     * webhook entries, the machine key's name.
     */
    access?: {
      entry: ServerEntryName;
      class: AccessClass;
      identity?: Identity;
      machineKey?: string;
    };
    accessMode?: AccessMode;
    authSeed?: string;
    insiderScopes?: NormalizedScopes | null;
    insiderEmail?: string;
    keyAge?: string | null;
    deepShareParams?: { d: string; dirs: string; s: string };
    authMatchedPath?: string | null;
  }
}
