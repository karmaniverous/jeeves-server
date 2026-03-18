/**
 * Rollup configuration for the OpenClaw plugin package.
 * Two entry points: plugin (ESM + declarations) and CLI (ESM executable).
 *
 * @remarks
 * `@karmaniverous/jeeves` is bundled (not external) because the plugin runs
 * inside `~/.openclaw/extensions/` where there is no `node_modules` tree.
 * Node builtins remain external since they're always available at runtime.
 */

import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import typescriptPlugin from '@rollup/plugin-typescript';
import type { RollupOptions } from 'rollup';

const nodeBuiltins = [
  'node:crypto',
  'node:child_process',
  'node:fs',
  'node:fs/promises',
  'node:module',
  'node:path',
  'node:os',
  'node:url',
  'crypto',
  'child_process',
  'fs',
  'path',
  'os',
  'url',
];

const pluginConfig: RollupOptions = {
  input: 'src/index.ts',
  external: nodeBuiltins,
  output: {
    dir: 'dist',
    format: 'esm',
  },
  plugins: [
    resolve({ preferBuiltins: true }),
    commonjs(),
    json(),
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
  external: nodeBuiltins,
  output: {
    file: 'dist/cli.js',
    format: 'esm',
    banner: '#!/usr/bin/env node',
  },
  plugins: [
    resolve({ preferBuiltins: true }),
    commonjs(),
    json(),
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
