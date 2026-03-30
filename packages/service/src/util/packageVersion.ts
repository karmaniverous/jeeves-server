/**
 * Resolve the service package version using package-directory.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { packageDirectorySync } from 'package-directory';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = packageDirectorySync({ cwd: __dirname });
if (!pkgDir) {
  throw new Error('Could not find package directory for jeeves-server');
}

const pkgPath = path.join(pkgDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
  version: string;
};

/** The package version of the jeeves-server service package. */
export const packageVersion: string = pkg.version;
