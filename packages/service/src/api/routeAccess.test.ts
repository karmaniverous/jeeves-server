/**
 * Tests for the access class table: its owner-fixed limits (Decision 8, 12).
 *
 * @packageDocumentation
 */

import {
  SERVER_CATALOG,
  type ServerEntryName,
} from '@karmaniverous/jeeves-server-core';
import { describe, expect, it } from 'vitest';

import { ROUTE_ACCESS, routeAccess } from './routeAccess.js';

const NAMES = SERVER_CATALOG.entries.map((e) => e.name);
const where = (test: (name: ServerEntryName) => boolean) =>
  NAMES.filter(test).sort();

describe('ROUTE_ACCESS', () => {
  it('classifies every catalog entry and nothing else', () => {
    expect(Object.keys(ROUTE_ACCESS).sort()).toEqual([...NAMES].sort());
  });

  it('admits the insider-seed key only on shareFor and rotateKey', () => {
    expect(where((n) => routeAccess(n).loginSeedKey)).toEqual([
      'rotateKey',
      'shareFor',
    ]);
  });

  it('fixes a content path only on drives', () => {
    expect(where((n) => routeAccess(n).contentPath !== undefined)).toEqual([
      'drives',
    ]);
    expect(routeAccess('drives')).toEqual({
      class: 'navigation',
      loginSeedKey: false,
      noScopedMachineKey: false,
      contentPath: '/',
    });
  });

  it('refuses scoped machine keys only on the runner proxy and OAuth', () => {
    expect(where((n) => routeAccess(n).noScopedMachineKey)).toEqual([
      'oauthStart',
      'oauthStatus',
      'oauthToken',
      'runnerDisableJob',
      'runnerEnableJob',
      'runnerGetJob',
      'runnerListJobs',
      'runnerListRuns',
      'runnerRunJob',
      'runnerStatus',
    ]);
    expect(routeAccess('runnerStatus')).toEqual({
      class: 'insider',
      loginSeedKey: false,
      noScopedMachineKey: true,
    });
  });

  it('makes config, configApply and listEvents the admin entries', () => {
    expect(where((n) => routeAccess(n).class === 'admin')).toEqual([
      'config',
      'configApply',
      'listEvents',
    ]);
  });

  it('gives every wildcard content entry a content class', () => {
    const content = SERVER_CATALOG.entries.filter(
      (e) =>
        e.path.endsWith('/*') &&
        ['navigation', 'content', 'content+insider'].includes(
          routeAccess(e.name).class,
        ),
    );
    expect(content.map((e) => e.name).sort()).toEqual([
      'browse',
      'export',
      'exportCacheClear',
      'exportMermaid',
      'exportPlantUml',
      'fileContent',
      'fileMutate',
      'fileWrite',
      'linkInfo',
      'raw',
    ]);
  });
});
