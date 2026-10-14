/**
 * Tests that each package's release-it git-cliff calls use the package's
 * prefixed tag, run with `node --test`.
 *
 * Each package tags releases as `<pkg>/<version>` (`git.tagName`) and its
 * `cliff.toml` only recognises `<pkg>/` tags (`tag_pattern`). git-cliff must be
 * given the same prefixed synthetic tag, or the release notes and changelog
 * are computed against the wrong tag history.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath, URL } from 'node:url';

const PACKAGES = ['core', 'service', 'openclaw'];

/** Read a file relative to the repository root. */
function read(relative) {
  return fs.readFileSync(
    fileURLToPath(new URL(`../${relative}`, import.meta.url)),
    'utf8',
  );
}

/** Every `--tag <value>` argument passed to git-cliff in a command. */
function cliffTags(command) {
  if (!command.includes('git-cliff')) return [];
  return [...command.matchAll(/--tag\s+(\S+)/g)].map((m) => m[1]);
}

for (const pkg of PACKAGES) {
  describe(`${pkg} release hooks`, () => {
    const manifest = JSON.parse(read(`packages/${pkg}/package.json`));
    const releaseIt = manifest['release-it'];
    const cliff = read(`packages/${pkg}/cliff.toml`);

    it('tags releases with the package prefix', () => {
      assert.equal(releaseIt.git.tagName, `${pkg}/\${version}`);
      assert.match(cliff, new RegExp(`tag_pattern = "${pkg}/`));
    });

    it('passes the prefixed tag to git-cliff for the release notes', () => {
      const notes = releaseIt.github.releaseNotes;
      assert.deepEqual(cliffTags(notes), [`${pkg}/\${version}`]);
      assert.match(notes, /--unreleased/);
      assert.match(notes, /--strip header/);
    });

    it('passes the prefixed tag to git-cliff when writing the changelog', () => {
      const calls = releaseIt.hooks['after:bump'].filter((c) =>
        c.includes('git-cliff'),
      );
      assert.equal(calls.length, 1);
      assert.deepEqual(cliffTags(calls[0]), [`${pkg}/\${version}`]);
      assert.match(calls[0], /-o CHANGELOG\.md/);
    });
  });
}
