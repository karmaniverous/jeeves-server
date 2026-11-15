/**
 * The access class of every server catalog entry (`ROUTE_ACCESS`, Decision 8): who may call it and which scope rule applies. Exhaustive over `SERVER_CATALOG`, so an unclassified entry is a compile error. Pure.
 *
 * @remarks
 * Classes: `public` (anyone; a credential is resolved but never fails the
 * request), `navigation` and `content` (an identity or a share credential,
 * checked against the content path), `content+insider` (an identity only,
 * on a content path), `insider` (an identity; handlers check the paths they
 * address), `admin` (an identity with no scopes, Decision 12),
 * `machineSeed` (raw machine seed in `X-API-Key`) and `eventKey` (a machine
 * key valid for `/event`). `loginSeedKey` admits the insider-seed insider
 * key (only `shareFor` and `rotateKey`); `contentPath` fixes the content
 * path of an entry without a `*` segment (`drives`).
 *
 * @packageDocumentation
 */

import type { ServerEntryName } from '@karmaniverous/jeeves-server-core';

/** An access class. */
export type AccessClass =
  | 'public'
  | 'navigation'
  | 'content'
  | 'content+insider'
  | 'insider'
  | 'admin'
  | 'machineSeed'
  | 'eventKey';

/** An entry's access: its class plus the class's options. */
export type RouteAccessValue =
  AccessClass | { class: AccessClass; loginSeedKey?: true; contentPath?: '/' };

/** An entry's access with every option resolved. */
export interface RouteAccess {
  /** The access class. */
  class: AccessClass;
  /** True when the insider-seed insider key authenticates the entry. */
  loginSeedKey: boolean;
  /** The fixed content path, for an entry without a `*` segment. */
  contentPath?: '/';
}

/** The access class of every catalog entry. */
export const ROUTE_ACCESS: Readonly<Record<ServerEntryName, RouteAccessValue>> =
  {
    status: 'public',
    config: 'admin',
    configApply: 'admin',
    health: 'public',
    authStatus: 'public',
    sendMagicLink: 'public',
    pathKey: 'machineSeed',
    insiderKey: 'machineSeed',
    search: 'insider',
    searchFacets: 'insider',
    drives: { class: 'navigation', contentPath: '/' },
    browse: 'navigation',
    fileContent: 'content',
    fileWrite: 'content+insider',
    fileMutate: 'content+insider',
    raw: 'content',
    export: 'content',
    exportCacheClear: 'content+insider',
    exportMermaid: 'content',
    exportPlantUml: 'content',
    linkInfo: 'navigation',
    diagram: 'public',
    publicContent: 'public',
    share: 'insider',
    shareFor: { class: 'insider', loginSeedKey: true },
    contentLink: 'public',
    readmeLink: 'public',
    resolvePath: 'insider',
    rotateKey: { class: 'insider', loginSeedKey: true },
    receiveEvent: 'eventKey',
    listEvents: 'admin',
    oauthStart: 'insider',
    oauthStatus: 'insider',
    oauthToken: 'insider',
    runnerListJobs: 'insider',
    runnerGetJob: 'insider',
    runnerListRuns: 'insider',
    runnerRunJob: 'insider',
    runnerEnableJob: 'insider',
    runnerDisableJob: 'insider',
    runnerStatus: 'insider',
  };

/**
 * An entry's access, options resolved.
 *
 * @param name - Entry name.
 * @returns Its access.
 */
export function routeAccess(name: ServerEntryName): RouteAccess {
  const value = ROUTE_ACCESS[name];
  if (typeof value === 'string') return { class: value, loginSeedKey: false };
  return {
    class: value.class,
    loginSeedKey: value.loginSeedKey ?? false,
    ...(value.contentPath ? { contentPath: value.contentPath } : {}),
  };
}

/** True when the class addresses a content path (share credentials apply). */
export function hasContentPath(access: RouteAccess): boolean {
  return (
    access.class === 'navigation' ||
    access.class === 'content' ||
    access.class === 'content+insider'
  );
}
