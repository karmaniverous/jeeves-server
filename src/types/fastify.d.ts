import type { AccessMode, NormalizedScopes } from '../config/types.js';

declare module 'fastify' {
  interface FastifyRequest {
    accessMode?: AccessMode;
    authSeed?: string;
    insiderScopes?: NormalizedScopes | null;
    insiderEmail?: string;
    keyAge?: string | null;
    deepShareParams?: { d: string; dirs: string; s: string };
    authMatchedPath?: string | null;
  }
}
