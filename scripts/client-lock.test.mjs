/**
 * Tests that the client's standalone lockfile matches its manifest, run
 * with `node --test`.
 *
 * `packages/service/client/package-lock.json` is tracked alongside the root
 * workspace lockfile, so a direct install from that folder resolves from
 * it. Its root entry must record the manifest's dependency ranges, or that
 * install resolves a different tree.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath, URL } from 'node:url';

/** Parse a JSON file relative to the repository root. */
function readJson(relative) {
  return JSON.parse(
    fs.readFileSync(
      fileURLToPath(new URL(`../${relative}`, import.meta.url)),
      'utf8',
    ),
  );
}

const manifest = readJson('packages/service/client/package.json');
const lock = readJson('packages/service/client/package-lock.json');
const root = lock.packages[''];

describe('client package-lock.json', () => {
  it('names the client package', () => {
    assert.equal(lock.name, manifest.name);
    assert.equal(root.name, manifest.name);
  });

  it('records the manifest dependency ranges', () => {
    assert.deepEqual(root.dependencies, manifest.dependencies);
  });

  it('records the manifest devDependency ranges', () => {
    assert.deepEqual(root.devDependencies, manifest.devDependencies);
  });

  it('locks a version for every direct dependency', () => {
    const names = Object.keys({
      ...manifest.dependencies,
      ...manifest.devDependencies,
    });
    for (const name of names) {
      assert.ok(
        lock.packages[`node_modules/${name}`]?.version,
        `${name} is not locked`,
      );
    }
  });
});
