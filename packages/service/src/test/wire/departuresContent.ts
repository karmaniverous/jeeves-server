/**
 * Approved wire departures for drives, browse, file content, raw files and link info: each departing scenario, what the branch base sent, and the decision that allows the change. Pure data.
 *
 * @packageDocumentation
 */

import {
  D4,
  D8,
  D8_NAVIGATION,
  type WireDeparture,
} from './departuresCommon.js';

/** Departures of the drives, browse, file content, raw files and link info scenarios. */
export const DEPARTURES_CONTENT: Readonly<Record<string, WireDeparture>> = {
  'drives none': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'drives insider key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'drives scoped machine key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D8_NAVIGATION,
    status: 200,
  },
  'drives bad key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'drives root path share': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'browse root none': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'browse root insider key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'browse root scoped insider key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'browse root scoped machine key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D8_NAVIGATION,
    status: 200,
  },
  'browse root bad key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'browse public expired share': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'browse public share for another path': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'browse deeper via deep share without dirs': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'browse file out of scope': {
    before: '403 {"error":"Path is outside your access scope"}',
    allowedBy: D4,
    status: 403,
    code: 'SERVER_OUT_OF_SCOPE',
  },
  'browse missing': {
    before: '404 {"error":"Not found","path":"{dir}/content/missing.md"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  'browse no root': {
    before: '404 {"error":"Invalid path"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  'browse traversal': {
    before: '400 {"error":"Invalid path"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_PATH',
  },
  'browse traversal backslash': {
    before: '400 {"error":"Invalid path"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_PATH',
  },
  'fileContent directory': {
    before: '400 {"error":"Use /api/path/ for directories"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_NOT_A_FILE',
  },
  'fileContent missing': {
    before: '404 {"error":"Not found"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  'fileContent no root': {
    before: '404 {"error":"Invalid path"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  'fileContent traversal': {
    before: '400 {"error":"Invalid path"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_PATH',
  },
  'fileContent traversal backslash': {
    before: '400 {"error":"Invalid path"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_PATH',
  },
  'fileContent empty path': {
    before: '400 {"error":"Path required"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_PATH',
  },
  'fileContent none': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'fileContent insider key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'fileContent scoped insider key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'fileContent scoped machine key out of scope': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D8,
    status: 403,
    code: 'SERVER_OUT_OF_SCOPE',
  },
  'fileContent scoped session out of scope': {
    before: '403 {"error":"Path is outside your access scope"}',
    allowedBy: D4,
    status: 403,
    code: 'SERVER_OUT_OF_SCOPE',
  },
  'fileContent bad key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'fileContent expired share': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'fileContent share for another path': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'raw directory': {
    before:
      '400 {"error":"Cannot serve directory as raw — use /api/export for ZIP"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_NOT_A_FILE',
  },
  'raw missing': {
    before: '404 {"error":"Not found","path":"{dir}/content/missing.md"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  'raw no root': {
    before: '404 {"error":"Invalid path"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  'raw empty path': {
    before: '400 {"error":"Path required"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_PATH',
  },
  'raw png none': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'raw png scoped machine key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D8,
    status: 403,
    code: 'SERVER_OUT_OF_SCOPE',
  },
  'linkInfo none': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'linkInfo no root': {
    before: '404 {"error":"Invalid path"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  'linkInfo empty path': {
    before: '400 {"error":"Path required"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_PATH',
  },
};
