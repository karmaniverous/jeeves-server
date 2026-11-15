/**
 * Rollup configuration for the jeeves-server-sdk package: one entry point (`src/index.ts`), ESM output with declarations; dependencies (and their sub-paths) stay external.
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs';

import typescriptPlugin from '@rollup/plugin-typescript';
import type { RollupOptions } from 'rollup';

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { dependencies?: Record<string, string> };

const config: RollupOptions = {
  input: 'src/index.ts',
  external: Object.keys(pkg.dependencies ?? {}).flatMap((dep) => [
    dep,
    new RegExp(`^${dep}/`),
  ]),
  output: {
    dir: 'dist',
    format: 'esm',
  },
  plugins: [
    typescriptPlugin({
      // Sources only, typed against the built core: tests are type-checked
      // by tsconfig.json.
      tsconfig: './tsconfig.build.json',
      outputToFilesystem: false,
      noEmit: false,
      declaration: true,
      declarationDir: 'dist',
      declarationMap: false,
      incremental: false,
      rootDir: 'src',
    }),
  ],
};

export default config;
