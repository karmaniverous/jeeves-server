/**
 * Approved wire departures for sharing, content and README links, resolve-path, rotation, search and the event log: each departing scenario, what the branch base sent, and the decision that allows the change. Pure data.
 *
 * @packageDocumentation
 */

import {
  D4,
  D8,
  D8_INSIDER,
  D8_LOGIN_SEED,
  D8_SCOPE,
  D8_SCOPED_KEY,
  D12,
  type WireDeparture,
} from './departuresCommon.js';

/** Departures of the sharing, content and README links, resolve-path, rotation, search and the event log scenarios. */
export const DEPARTURES_SHARING: Readonly<Record<string, WireDeparture>> = {
  'share none': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'share insider key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'share scoped machine key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D8_SCOPED_KEY,
    status: 200,
  },
  'share path share': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'share missing path': {
    before: '400 {"error":"path is required"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_REQUEST',
  },
  'share scoped session out of scope': {
    before: '403 {"error":"Path is outside your access scope"}',
    allowedBy: D4,
    status: 403,
    code: 'SERVER_OUT_OF_SCOPE',
  },
  'shareFor none': {
    before: '401 {"error":"Insider auth required for utility endpoints"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'shareFor path share': {
    before: '401 {"error":"Insider auth required for utility endpoints"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'shareFor missing path': {
    before: '400 {"error":"path is required"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_REQUEST',
  },
  'shareFor insiders not an array': {
    before: '400 {"error":"insiders array is required"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_REQUEST',
  },
  'contentLink unknown': {
    before: '404 {"error":"nope.md not found"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  'contentLink invalid name': {
    before: '400 {"error":"Invalid file name"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_REQUEST',
  },
  'resolvePath none': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'resolvePath insider key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'resolvePath scoped machine key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D8_SCOPE,
    status: 403,
    code: 'SERVER_OUT_OF_SCOPE',
  },
  'resolvePath path share': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'resolvePath scoped machine key in scope': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D8_SCOPED_KEY,
    status: 200,
  },
  'resolvePath missing fsPath': {
    before: '400 {"error":"fsPath query parameter required"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_REQUEST',
  },
  'resolvePath relative': {
    before: '400 {"error":"fsPath must be an absolute path"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_PATH',
  },
  'resolvePath outside roots': {
    before: '404 {"error":"Path does not fall under any configured root"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  'rotateKey none': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'rotateKey insider key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D8_LOGIN_SEED,
    status: 200,
  },
  'rotateKey machine key': {
    before: '403 {"error":"Insider auth required"}',
    allowedBy: D4,
    status: 403,
    code: 'SERVER_MACHINE_KEY_NOT_ROTATABLE',
  },
  'rotateKey scoped machine key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D8,
    status: 403,
    code: 'SERVER_MACHINE_KEY_NOT_ROTATABLE',
  },
  'rotateKey path share': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'search none': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'search session': {
    before: '502 {"error":"Watcher unreachable: TypeError: fetch failed"}',
    allowedBy: D4,
    status: 502,
    code: 'SERVER_WATCHER_UNAVAILABLE',
  },
  'search scoped session': {
    before: '502 {"error":"Watcher unreachable: TypeError: fetch failed"}',
    allowedBy: D4,
    status: 502,
    code: 'SERVER_WATCHER_UNAVAILABLE',
  },
  'search insider key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'search machine key': {
    before: '502 {"error":"Watcher unreachable: TypeError: fetch failed"}',
    allowedBy: D4,
    status: 502,
    code: 'SERVER_WATCHER_UNAVAILABLE',
  },
  'search scoped machine key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D8_SCOPED_KEY,
    status: 502,
    code: 'SERVER_WATCHER_UNAVAILABLE',
  },
  'search path share': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'search missing query': {
    before: '400 {"error":"query is required"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_REQUEST',
  },
  'searchFacets none': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'searchFacets session': {
    before: '502 {"error":"Failed to reach watcher","detail":"fetch failed"}',
    allowedBy: D4,
    status: 502,
    code: 'SERVER_WATCHER_UNAVAILABLE',
  },
  'searchFacets scoped session': {
    before: '502 {"error":"Failed to reach watcher","detail":"fetch failed"}',
    allowedBy: D4,
    status: 502,
    code: 'SERVER_WATCHER_UNAVAILABLE',
  },
  'searchFacets insider key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'searchFacets machine key': {
    before: '502 {"error":"Failed to reach watcher","detail":"fetch failed"}',
    allowedBy: D4,
    status: 502,
    code: 'SERVER_WATCHER_UNAVAILABLE',
  },
  'searchFacets scoped machine key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D8_INSIDER,
    status: 502,
    code: 'SERVER_WATCHER_UNAVAILABLE',
  },
  'searchFacets path share': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'listEvents none': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'listEvents scoped session': {
    before: '403 {"error":"Unscoped insider access required"}',
    allowedBy: D4,
    status: 403,
    code: 'SERVER_FORBIDDEN',
  },
  'listEvents insider key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'listEvents scoped machine key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D12,
    status: 403,
    code: 'SERVER_FORBIDDEN',
  },
  'listEvents path share': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'resolvePath scoped session': {
    before:
      '200 {"browsePath":"{root}/doc.md",...} for a path outside the session\'s scopes',
    allowedBy: D8_SCOPE,
    status: 403,
    code: 'SERVER_OUT_OF_SCOPE',
  },
};
