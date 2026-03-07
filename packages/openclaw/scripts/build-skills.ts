/**
 * Copy skill files into dist/ for distribution.
 */
import { cpSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, '..');
const src = join(pkgRoot, 'skills');
const dest = join(pkgRoot, 'dist', 'skills');

if (existsSync(src)) {
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log('Skills copied to dist/skills/');
} else {
  console.log('No skills directory found, skipping.');
}
