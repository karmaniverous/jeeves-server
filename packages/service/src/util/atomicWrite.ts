/**
 * Atomic file replacement: write a temp file beside the target, then rename it over the target, so a failed or interrupted write (full disk, crash) leaves the previous content intact.
 *
 * @packageDocumentation
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Replace a file's content atomically (temp file + rename). On failure the
 * temp file is removed and the error rethrown; the target is untouched.
 *
 * @param filePath - The file to write.
 * @param content - Its new content (UTF-8).
 */
export function writeFileAtomic(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpFile = path.join(
    dir,
    `.${path.basename(filePath)}.${crypto.randomBytes(6).toString('hex')}.tmp`,
  );
  try {
    fs.writeFileSync(tmpFile, content, 'utf8');
    fs.renameSync(tmpFile, filePath);
  } catch (err) {
    fs.rmSync(tmpFile, { force: true });
    throw err;
  }
}
