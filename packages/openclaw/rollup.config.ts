/**
 * Rollup configuration for the OpenClaw plugin package.
 * Two entry points: plugin (ESM + declarations) and CLI (ESM executable).
 */

import typescriptPlugin from '@rollup/plugin-typescript';
import type { RollupOptions } from 'rollup';

const nodeBuiltins = [
  'node:crypto',
  'node:child_process',
  'node:fs',
  'node:fs/promises',
  'node:path',
  'node:os',
  'node:module',
  'node:url',
  'crypto',
  'child_process',
  'fs',
  'path',
  'os',
  'url',
];

const externalPackages = ['@karmaniverous/jeeves'];

const pluginConfig: RollupOptions = {
  input: 'src/index.ts',
  external: [...nodeBuiltins, ...externalPackages],
  output: {
    dir: 'dist',
    format: 'esm',
  },
  plugins: [
    typescriptPlugin({
      tsconfig: './tsconfig.json',
      outputToFilesystem: false,
      noEmit: false,
      declaration: true,
      declarationDir: 'dist',
      declarationMap: false,
      incremental: false,
    }),
  ],
};

const cliConfig: RollupOptions = {
  input: 'src/cli.ts',
  external: [...nodeBuiltins, ...externalPackages],
  output: {
    file: 'dist/cli.js',
    format: 'esm',
    banner: '#!/usr/bin/env node',
  },
  plugins: [
    typescriptPlugin({
      tsconfig: './tsconfig.json',
      outputToFilesystem: false,
      noEmit: false,
      declaration: false,
      incremental: false,
    }),
  ],
};

export default [pluginConfig, cliConfig];
