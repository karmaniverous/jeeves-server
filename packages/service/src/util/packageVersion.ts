/**
 * Resolve the service package version by walking up from the caller's directory.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function findPackageJson(startDir: string): string {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, 'package.json');
    if (fs.existsSync(candidate)) {
      const pkg = JSON.parse(fs.readFileSync(candidate, 'utf8')) as {
        name?: string;
      };
      // Find our package specifically, not the monorepo root
      if (pkg.name === '@karmaniverous/jeeves-server') return candidate;
    }
    dir = path.dirname(dir);
  }
  throw new Error('Could not find @karmaniverous/jeeves-server package.json');
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = findPackageJson(__dirname);
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version: string };

/** The package version of the jeeves-server service package. */
export const packageVersion: string = pkg.version;
