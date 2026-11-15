/**
 * What the SDK ships and pulls in: runtime dependencies are exactly jeeves (the range every package uses) and server-core, sources import only the two browser-safe entry points, and the release config matches the other packages.
 */

import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

interface Pkg {
  name: string;
  version: string;
  engines: { node: string };
  dependencies: Record<string, string>;
  files: string[];
  publishConfig: { access: string };
  scripts: Record<string, string>;
  'release-it': {
    git: { tagName: string };
    github: { releaseName: string; releaseNotes: string };
    hooks: Record<string, string[]>;
  };
}

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');
const pkg = JSON.parse(read('../package.json')) as Pkg;
const core = JSON.parse(read('../../core/package.json')) as Pkg;

const sources = readdirSync(new URL('.', import.meta.url)).filter(
  (f) => f.endsWith('.ts') && !f.endsWith('.test.ts'),
);
const imports = sources.flatMap((f) =>
  [...read(`./${f}`).matchAll(/from '([^'.][^']*)'/g)].map((m) => m[1]),
);

describe('packaging', () => {
  it('depends on jeeves (as core does) and server-core only', () => {
    expect(Object.keys(pkg.dependencies).sort()).toEqual([
      '@karmaniverous/jeeves',
      '@karmaniverous/jeeves-server-core',
    ]);
    expect(pkg.dependencies['@karmaniverous/jeeves']).toBe(
      core.dependencies['@karmaniverous/jeeves'],
    );
  });

  it('imports only the browser-safe catalog entry points', () => {
    expect(new Set(imports)).toEqual(
      new Set([
        '@karmaniverous/jeeves/catalog',
        '@karmaniverous/jeeves-server-core/catalog',
      ]),
    );
  });

  it('ships dist only, publicly, for Node 24.22.2 or later', () => {
    expect(pkg.files).toEqual(['dist']);
    expect(pkg.publishConfig.access).toBe('public');
    expect(pkg.engines.node).toBe(core.engines.node);
  });

  it('releases as sdk/<version> with the core-range guard, like core', () => {
    const release = pkg['release-it'];
    expect(release.git.tagName).toBe('sdk/${version}');
    expect(release.github.releaseName).toBe(
      core['release-it'].github.releaseName,
    );
    expect(release.hooks['before:init']).toEqual([
      'node ../../scripts/check-core-range.mjs',
    ]);
    expect(pkg.scripts.release).toBe(core.scripts.release);
    expect(pkg.scripts['release:pre']).toBe(core.scripts['release:pre']);
  });
});
