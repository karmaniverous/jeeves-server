/**
 * `shareFor` (`POST /api/util/share-for`): the link to send an audience of insiders and outsiders for a path. Blocked when the sharer or an insider in the audience can't see the path; an insider link when everyone is an insider; otherwise an outsider share (subject to the outsider policy unless the caller waives it, with a warning).
 *
 * @packageDocumentation
 */

import { Unauthorized } from '../../api/errors.js';
import { type HandlersFor, ok } from '../../api/handlerTypes.js';
import { _pathMatchesScopes } from '../../auth/keys.js';
import { findInsider } from '../../auth/resolve.js';
import { getConfig } from '../../config/index.js';
import { isDirectoryUrlPath } from '../../services/contentPath.js';
import { createDeepShare, createPathShare } from '../../services/shareLinks.js';
import { getPublicOrigin } from '../../util/publicOrigin.js';
import { requireNoShareTraversal } from './contentRoute.js';

/** The share-for handler. */
export const shareForHandlers: HandlersFor<'shareFor'> = {
  shareFor: ({ body }, request) => {
    const config = getConfig();
    const sharerSeed = request.authSeed;
    const sharerScopes = request.insiderScopes ?? null;
    if (!sharerSeed) throw new Unauthorized('Authentication required');

    const {
      path: targetPath,
      insiders: audienceIds,
      depth,
      dirs,
      enforceOutsiderPolicy,
    } = body;
    requireNoShareTraversal(targetPath);

    if (sharerScopes && !_pathMatchesScopes(targetPath, sharerScopes)) {
      return Promise.resolve(
        ok({
          url: null,
          type: 'blocked' as const,
          reason: 'Sharer does not have access to this path',
          blocked: [],
        }),
      );
    }

    const blockedInsiders: string[] = [];
    const unknownIds: string[] = [];

    for (const id of audienceIds) {
      const insider = findInsider(config.resolvedInsiders, id);
      if (!insider || !insider.seed) {
        unknownIds.push(id);
        continue;
      }
      if (insider.scopes && !_pathMatchesScopes(targetPath, insider.scopes)) {
        blockedInsiders.push(id);
      }
    }

    if (blockedInsiders.length > 0) {
      return Promise.resolve(
        ok({
          url: null,
          type: 'blocked' as const,
          reason: 'Insider(s) do not have access to this path',
          blocked: blockedInsiders,
        }),
      );
    }

    const hasOutsiders = unknownIds.length > 0;

    // Absolute URLs only from the configured public origin; otherwise
    // relative (never from untrusted request headers).
    const origin = getPublicOrigin(config, request) ?? '';

    if (!hasOutsiders) {
      return Promise.resolve(
        ok({
          url: `${origin}/browse${targetPath}`,
          type: 'insider' as const,
        }),
      );
    }

    const outsiderPolicy = config.outsiderPolicy;
    const policyEnforced = enforceOutsiderPolicy !== false;

    if (outsiderPolicy && policyEnforced) {
      if (!_pathMatchesScopes(targetPath, outsiderPolicy)) {
        return Promise.resolve(
          ok({
            url: null,
            type: 'policy-denied' as const,
            reason: 'Outsider policy does not allow sharing this path',
          }),
        );
      }
    }

    const shareDepth = depth ?? 0;
    const shareDirs = dirs ?? false;
    // A directory shared without depth or dirs is a tree share: a plain path
    // key covers every file below it, as the UI's directory links do.
    // Otherwise the same deep share as POST /api/share, which always emits
    // d (also d=0) so verification recognises a deep key (#282).
    const share =
      shareDepth <= 0 && !shareDirs && isDirectoryUrlPath(targetPath)
        ? createPathShare(sharerSeed, targetPath)
        : createDeepShare(sharerSeed, targetPath, {
            depth: shareDepth,
            dirs: shareDirs,
          });

    const wouldDeny =
      outsiderPolicy &&
      !policyEnforced &&
      !_pathMatchesScopes(targetPath, outsiderPolicy);
    return Promise.resolve(
      ok({
        url: `${origin}${share.url}`,
        type: 'outsider-share' as const,
        ...(wouldDeny
          ? { warning: 'Outsider policy would deny this path' }
          : {}),
      }),
    );
  },
};
