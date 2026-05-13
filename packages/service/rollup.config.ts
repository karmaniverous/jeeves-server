import fs from 'node:fs';

import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import typescriptPlugin from '@rollup/plugin-typescript';
import type { RollupOptions } from 'rollup';

const pkg = JSON.parse(
  fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { dependencies?: Record<string, string> };

const external = [/^node:/, ...Object.keys(pkg.dependencies ?? {})];

const tsPlugin = () =>
  typescriptPlugin({
    tsconfig: './tsconfig.build.json',
    outputToFilesystem: false,
    noEmit: false,
    declaration: false,
    incremental: false,
  });

const serverConfig: RollupOptions = {
  input: 'src/server.ts',
  output: {
    dir: 'dist',
    format: 'esm',
    preserveModules: true,
    preserveModulesRoot: '.',
  },
  external,
  plugins: [resolve({ preferBuiltins: true }), commonjs(), json(), tsPlugin()],
};

const cliConfig: RollupOptions = {
  input: 'src/cli/index.ts',
  output: {
    dir: 'dist',
    format: 'esm',
    preserveModules: true,
    preserveModulesRoot: '.',
  },
  external,
  plugins: [resolve({ preferBuiltins: true }), commonjs(), json(), tsPlugin()],
};

export default [serverConfig, cliConfig];
