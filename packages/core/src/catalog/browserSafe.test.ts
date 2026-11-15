/**
 * The `./catalog` entry is browser-safe: its whole import graph (core's own modules and the parts of `@karmaniverous/jeeves/catalog` it loads) reaches only `zod` and `@karmaniverous/jeeves/catalog`, never a Node built-in or any other package.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/** Module specifiers in `import ... from`, `export ... from` and `import()`. */
const SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm;

/**
 * Walk an import graph from a file, collecting the bare specifiers it reaches.
 *
 * @param entry - Absolute path of the first module.
 * @param toFile - Maps a relative specifier (resolved) to the file to read.
 * @returns Every bare (non-relative) specifier, and the files visited.
 */
function walk(entry: string, toFile: (resolved: string) => string) {
  const bare = new Set<string>();
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const [, spec] of readFileSync(file, 'utf8').matchAll(SPECIFIER)) {
      if (spec.startsWith('.'))
        queue.push(toFile(resolve(dirname(file), spec)));
      else bare.add(spec);
    }
  }
  return { bare: [...bare].sort(), files: [...seen] };
}

describe('the ./catalog entry', () => {
  it('imports only zod and @karmaniverous/jeeves/catalog', () => {
    const entry = fileURLToPath(new URL('./index.ts', import.meta.url));
    const { bare, files } = walk(entry, (p) => p.replace(/\.js$/, '.ts'));
    expect(bare).toEqual(['@karmaniverous/jeeves/catalog', 'zod']);
    // The graph covers the catalog, its entries and the error codes.
    expect(files.some((f) => f.endsWith('errors.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('runnerEntries.ts'))).toBe(true);
  });

  it('pulls in nothing but zod through @karmaniverous/jeeves/catalog', () => {
    const entry = fileURLToPath(
      import.meta.resolve('@karmaniverous/jeeves/catalog'),
    );
    expect(walk(entry, (p) => p).bare).toEqual(['zod']);
  });

  it('would catch a Node built-in in the graph', () => {
    const self = fileURLToPath(import.meta.url);
    expect(walk(self, (p) => p).bare).toContain('node:fs');
  });
});
