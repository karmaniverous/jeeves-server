/**
 * Sharing handlers: `readmeLink`, `contentLink`, `share` and `rotateKey` (the one rotation route, #292); `shareFor` is shareFor.ts.
 *
 * @packageDocumentation
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { packageDirectorySync } from 'package-directory';

import {
  capArg,
  Forbidden,
  InternalKeyMissing,
  InvalidRequest,
  MachineKeyNotRotatable,
  NotFound,
  Unauthorized,
} from '../../api/errors.js';
import { type HandlersFor, ok } from '../../api/handlerTypes.js';
import { findInsider } from '../../auth/resolve.js';
import { getConfig, resetConfig } from '../../config/index.js';
import { INTERNAL_KEY_NAME } from '../../config/types.js';
import { isDirectoryUrlPath } from '../../services/contentPath.js';
import { appendEvent } from '../../services/eventQueue.js';
import { createDeepShare, createPathShare } from '../../services/shareLinks.js';
import { writeInsiderSeedToConfig } from '../../util/configPersist.js';
import { fsPathToUrl, getRoots } from '../../util/platform.js';
import { requireNoTraversal } from './contentRoute.js';
import { requireInScope } from './scopeGuard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the package root via `package-directory` rather than fixed `..`
 * hops, which break when the compiled output adds a `dist/` layer.
 */
const serverRoot = packageDirectorySync({ cwd: __dirname }) ?? __dirname;

/** The _internal key seed (`SERVER_INTERNAL_KEY_MISSING` without one). */
function getInternalSeed(): string {
  const internalKey = getConfig().resolvedKeys.find(
    (k) => k.name === INTERNAL_KEY_NAME,
  );
  if (!internalKey?.seed) throw new InternalKeyMissing();
  return internalKey.seed;
}

/** The sharing handlers (`shareFor`: shareFor.ts). */
export const sharingHandlers: HandlersFor<
  'readmeLink' | 'contentLink' | 'share' | 'rotateKey'
> = {
  readmeLink: () => {
    const seed = getInternalSeed();

    const readmePath = path.join(serverRoot, 'README.md');
    if (!fs.existsSync(readmePath)) throw new NotFound('README.md not found');

    const urlPath = fsPathToUrl(readmePath, getRoots(getConfig().roots));
    const { url } = createDeepShare(seed, urlPath, { depth: 2, dirs: false });
    return Promise.resolve(ok({ url }));
  },
  contentLink: ({ params }) => {
    const seed = getInternalSeed();

    const { file } = params;
    if (!/^[\w-]+$/.test(file)) throw new InvalidRequest('Invalid file name');

    const contentPath = path.join(serverRoot, 'content', `${file}.md`);
    if (!fs.existsSync(contentPath))
      throw new NotFound(`${capArg(file)}.md not found`);

    const urlPath = fsPathToUrl(contentPath, getRoots(getConfig().roots));
    const { url } = createDeepShare(seed, urlPath, { depth: 0, dirs: false });
    return Promise.resolve(ok({ url }));
  },
  share: ({ body }, request) => {
    const seed = request.authSeed;
    if (!seed) throw new Unauthorized('Insider auth required');

    const { path: targetPath, expiry, depth, dirs } = body;
    requireNoTraversal(targetPath);

    requireInScope(request, targetPath);

    const share =
      (depth && depth > 0) || dirs
        ? createDeepShare(seed, targetPath, {
            depth: depth ?? 0,
            dirs: dirs ?? false,
            exp: expiry,
          })
        : createPathShare(seed, targetPath, expiry);

    return Promise.resolve(
      ok({
        url: share.url,
        path: targetPath,
        exp: expiry ?? null,
        depth: depth ?? 0,
        dirs: dirs ?? false,
        isDirectory: isDirectoryUrlPath(targetPath),
      }),
    );
  },
  rotateKey: async (_input, request) => {
    const insiderEmail = request.insiderEmail;
    // Machine keys reach here without an email: they rotate through config.
    if (!insiderEmail) throw new MachineKeyNotRotatable();

    const config = getConfig();
    const insider = findInsider(config.resolvedInsiders, insiderEmail);
    if (!insider) throw new Forbidden('Not an insider');

    const newSeed = crypto.randomBytes(32).toString('hex');
    const now = new Date().toISOString();
    await writeInsiderSeedToConfig(insider.email, newSeed, now);
    appendEvent({ kind: 'insider_key_rotated', email: insider.email, at: now });
    resetConfig();

    return ok({
      ok: true as const,
      keyCreatedAt: now,
      invalidates: ['insiderKey', 'outsiderLinks'] as (
        'insiderKey' | 'outsiderLinks'
      )[],
    });
  },
};
