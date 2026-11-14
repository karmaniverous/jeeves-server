/**
 * Release guard: fail when a package's declared range for a sibling workspace
 * package (core by default, or the SDK) does not admit the sibling's current
 * version.
 *
 * The SDK, server and plugin bundles import core (and the server and plugin
 * the SDK) at runtime, so publishing them with a range that excludes the
 * sibling they were built against installs one without the exports they
 * need. Run from the package being released (the release-it `before:init`
 * hook does this):
 *
 *   node ../../scripts/check-core-range.mjs [--sibling <sibling package.json>] [--package <package.json>]
 *
 * `--sibling` defaults to `packages/core/package.json` in this repository and
 * `--package` to `package.json` in the working directory.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import semver from 'semver';

const scriptPath = fileURLToPath(import.meta.url);
const defaultCorePath = path.resolve(
  path.dirname(scriptPath),
  '../packages/core/package.json',
);

const DEPENDENCY_FIELDS = [
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
  'devDependencies',
];

/** Read and parse a JSON file. */
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Check a package manifest's declared range for a sibling workspace package
 * (`core`: the sibling's manifest) against the sibling's version. Returns
 * `{ ok, message }`.
 */
export function checkCoreRange(core, pkg) {
  const field = DEPENDENCY_FIELDS.find((f) => pkg[f]?.[core.name]);
  if (!field) {
    return {
      ok: false,
      message: `${pkg.name} does not depend on ${core.name}.`,
    };
  }

  const range = pkg[field][core.name];
  if (semver.satisfies(core.version, range)) {
    return {
      ok: true,
      message: `${pkg.name}: ${core.name} range ${range} admits ${core.version}.`,
    };
  }

  return {
    ok: false,
    message: [
      `${pkg.name} declares ${core.name} ${range} (${field}), which does not admit the workspace version ${core.version}.`,
      `Raise the range (e.g. ^${core.version}) in the release commit, and release ${core.name} first.`,
    ].join('\n'),
  };
}

/** Parse `--sibling` and `--package` options. */
function parseArgs(argv) {
  const options = {
    sibling: defaultCorePath,
    package: path.resolve('package.json'),
  };
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i]?.replace(/^--/u, '');
    const value = argv[i + 1];
    if (!(name === 'sibling' || name === 'package') || value === undefined) {
      throw new Error(`Unknown or incomplete option: ${String(argv[i])}`);
    }
    options[name] = path.resolve(value);
  }
  return options;
}

/** CLI entry: exit 0 when the range admits the sibling, 1 otherwise. */
function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = checkCoreRange(
      readJson(options.sibling),
      readJson(options.package),
    );
    if (result.ok) {
      process.stdout.write(`${result.message}\n`);
      return 0;
    }
    process.stderr.write(`Release blocked: ${result.message}\n`);
    return 1;
  } catch (error) {
    process.stderr.write(
      `Release blocked: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  process.exitCode = main();
}
