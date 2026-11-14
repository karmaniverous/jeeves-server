/**
 * Vitest config for recording the wire baseline: runs only `src/test/wire/wireRecord.record.ts`, which writes every scenario's reply to the file named by `WIRE_RECORD`. Used by `scripts/capture-wire.ts`; not part of `npm test`.
 *
 * Standalone rather than merged with `vitest.config.ts`: a stale tracked
 * `vitest.config.js` (no core alias) would shadow the `.ts` config in an
 * import, because Vite resolves `.js` before `.ts`.
 *
 * @packageDocumentation
 */
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Record against workspace source, never build output (dist/).
    alias: {
      '@karmaniverous/jeeves-server-core': fileURLToPath(
        new URL('../core/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/test/wire/wireRecord.record.ts'],
  },
});
