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
      // The web client's own `@/` alias (client/vite.config.ts), for client
      // tests that import client modules.
      '@': fileURLToPath(new URL('./client/src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    exclude: ['dist/**', '.rollup.cache/**', '**/node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});
