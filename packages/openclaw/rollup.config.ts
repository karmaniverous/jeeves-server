/**
 * Rollup configuration for the OpenClaw plugin package.
 * Single entry point: the plugin (ESM + declarations).
 */

import fs from 'node:fs';
import { builtinModules } from 'node:module';

import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import typescriptPlugin from '@rollup/plugin-typescript';
import type { RollupOptions } from 'rollup';

const pkg = JSON.parse(
  fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { dependencies?: Record<string, string> };

const external = [
  /^node:/,
  ...builtinModules,
  ...builtinModules.map((m) => new RegExp(`^${m}/`)),
  ...Object.keys(pkg.dependencies ?? {}).flatMap((dep) => [
    dep,
    new RegExp(`^${dep}/`),
  ]),
];

const pluginConfig: RollupOptions = {
  input: 'src/index.ts',
  external,
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

export default pluginConfig;
