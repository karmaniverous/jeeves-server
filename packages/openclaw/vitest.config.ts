import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Test against workspace source, never build output (dist/).
    // More specific keys first: an alias also matches its sub-paths.
    alias: {
      '@karmaniverous/jeeves-server-core/catalog': fileURLToPath(
        new URL('../core/src/catalog/index.ts', import.meta.url),
      ),
      '@karmaniverous/jeeves-server-sdk': fileURLToPath(
        new URL('../sdk/src/index.ts', import.meta.url),
      ),
      '@karmaniverous/jeeves-server-core': fileURLToPath(
        new URL('../core/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
  },
});
