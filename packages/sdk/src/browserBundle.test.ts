/**
 * Browser safety: Rollup bundles the SDK from source for the browser (`browser` export conditions, no Node built-ins) with every dependency inlined. Any import of a Node built-in, or anything left unresolved, fails the build.
 */

import { existsSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { nodeResolve } from '@rollup/plugin-node-resolve';
import { type Plugin, rollup } from 'rollup';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const entry = fileURLToPath(new URL('./index.ts', import.meta.url));
const coreCatalog = fileURLToPath(
  new URL('../../core/src/catalog/index.ts', import.meta.url),
);

const BUILTINS = new Set(builtinModules);

/**
 * Fail on Node built-ins; resolve core's catalog to its source and relative
 * `.js` specifiers of TypeScript sources to their `.ts` files.
 */
const workspaceSources: Plugin = {
  name: 'workspace-sources',
  resolveId(source, importer) {
    if (source.startsWith('node:') || BUILTINS.has(source))
      this.error(`Node built-in "${source}" imported by ${String(importer)}`);
    if (source === '@karmaniverous/jeeves-server-core/catalog')
      return coreCatalog;
    if (importer?.endsWith('.ts') && source.startsWith('.')) {
      const file = resolve(dirname(importer), source.replace(/\.js$/, '.ts'));
      if (existsSync(file)) return file;
    }
    return null;
  },
  transform(code, id) {
    if (!id.endsWith('.ts')) return null;
    const { outputText } = ts.transpileModule(code, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        verbatimModuleSyntax: false,
      },
      fileName: id,
    });
    return { code: outputText, map: null };
  },
};

/**
 * Bundle a module for the browser.
 *
 * @param input - Entry file.
 * @param extra - Plugins run before resolution (to inject a fault).
 * @returns The bundle's imports and code.
 */
async function bundle(input: string, extra: Plugin[] = []) {
  const build = await rollup({
    input,
    plugins: [
      ...extra,
      workspaceSources,
      nodeResolve({ browser: true, preferBuiltins: false }),
    ],
    // An import nothing resolves would stay external: fail on it. Other
    // warnings (zod's annotation comments) don't affect the bundle.
    onwarn(warning) {
      if (warning.code === 'UNRESOLVED_IMPORT')
        throw new Error(`UNRESOLVED_IMPORT: ${warning.message}`);
    },
  });
  try {
    const { output } = await build.generate({ format: 'esm' });
    return { imports: output[0].imports, code: output[0].code };
  } finally {
    await build.close();
  }
}

describe('browser bundle', () => {
  it('builds with every dependency inlined and no Node built-in', async () => {
    const { imports, code } = await bundle(entry);
    expect(imports).toEqual([]);
    expect(code).toContain('createServerClient');
    expect(code).toContain('/api/raw/');
  }, 60_000);

  it('fails when anything in the graph imports a Node built-in', async () => {
    const fault: Plugin = {
      name: 'fault',
      transform(code, id) {
        return id === entry ? `import 'node:crypto';\n${code}` : null;
      },
    };
    await expect(bundle(entry, [fault])).rejects.toThrow(
      /Node built-in "node:crypto"/,
    );
  }, 60_000);
});
