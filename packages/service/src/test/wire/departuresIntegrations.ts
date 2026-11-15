/**
 * Approved wire departures for OAuth and the runner proxy: each departing scenario, what the branch base sent, and the decision that allows the change. Pure data.
 *
 * @packageDocumentation
 */

import {
  D_VALIDATION,
  D4,
  D4_RUNNER,
  D8_INSIDER,
  D28,
  D29,
  type WireDeparture,
} from './departuresCommon.js';

/** Departures of the OAuth and the runner proxy scenarios. */
export const DEPARTURES_INTEGRATIONS: Readonly<Record<string, WireDeparture>> =
  {
    'oauthStart none': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'oauthStart insider key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'oauthStart scoped machine key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: `${D8_INSIDER}; ${D29}`,
      status: 403,
      code: 'SERVER_FORBIDDEN',
    },
    'oauthStart path share': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'oauthStart no client credentials': {
      before:
        '400 {"error":"provider, account, clientId, and clientSecret are required"}',
      allowedBy: `${D4}; ${D_VALIDATION}`,
      status: 400,
      code: 'FST_ERR_VALIDATION',
    },
    'oauthStart unknown provider': {
      before:
        '400 {"error":"authUrl and tokenUrl are required (either in request body or via named provider config)"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'oauthStart missing fields': {
      before:
        '400 {"error":"provider, account, clientId, and clientSecret are required"}',
      allowedBy: `${D4}; ${D_VALIDATION}`,
      status: 400,
      code: 'FST_ERR_VALIDATION',
    },
    'oauthStart invalid name': {
      before:
        '400 {"error":"provider and account may only contain letters, digits, \\".\\", \\"_\\", \\"-\\", \\"@\\" and \\"+\\", and may not be \\".\\" or \\"..\\""}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'oauthStart bad origin': {
      before: '400 {"error":"origin must be a valid URL"}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'oauthToken expired': {
      before:
        '401 {"error":"refresh_failed","message":"Re-authorization required"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_OAUTH_REFRESH_FAILED',
    },
    'oauthToken missing file': {
      before: '404 {"error":"Credential file not found"}',
      allowedBy: D4,
      status: 404,
      code: 'SERVER_NOT_FOUND',
    },
    'oauthStatus missing params': {
      before: '400 {"error":"provider and account query params required"}',
      allowedBy: `${D4}; ${D_VALIDATION}`,
      status: 400,
      code: 'FST_ERR_VALIDATION',
    },
    'oauthToken missing params': {
      before: '400 {"error":"provider and account query params required"}',
      allowedBy: `${D4}; ${D_VALIDATION}`,
      status: 400,
      code: 'FST_ERR_VALIDATION',
    },
    'oauthStatus invalid name': {
      before:
        '400 {"error":"provider and account may only contain letters, digits, \\".\\", \\"_\\", \\"-\\", \\"@\\" and \\"+\\", and may not be \\".\\" or \\"..\\""}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'oauthToken invalid name': {
      before:
        '400 {"error":"provider and account may only contain letters, digits, \\".\\", \\"_\\", \\"-\\", \\"@\\" and \\"+\\", and may not be \\".\\" or \\"..\\""}',
      allowedBy: D4,
      status: 400,
      code: 'SERVER_INVALID_REQUEST',
    },
    'oauthStatus none': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'oauthToken scoped machine key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: `${D8_INSIDER}; ${D28}; ${D29}`,
      status: 403,
      code: 'SERVER_FORBIDDEN',
    },
    'runner GET /api/runner/jobs': {
      before: '502 {"error":"Runner unreachable"}',
      allowedBy: D4_RUNNER,
      status: 503,
      code: 'SERVER_RUNNER_UNAVAILABLE',
    },
    'runner GET /api/runner/jobs/alpha': {
      before: '502 {"error":"Runner unreachable"}',
      allowedBy: D4_RUNNER,
      status: 503,
      code: 'SERVER_RUNNER_UNAVAILABLE',
    },
    'runner GET /api/runner/jobs/alpha/runs?limit=5': {
      before: '502 {"error":"Runner unreachable"}',
      allowedBy: D4_RUNNER,
      status: 503,
      code: 'SERVER_RUNNER_UNAVAILABLE',
    },
    'runner POST /api/runner/jobs/alpha/run': {
      before: '502 {"error":"Runner unreachable"}',
      allowedBy: D4_RUNNER,
      status: 503,
      code: 'SERVER_RUNNER_UNAVAILABLE',
    },
    'runner POST /api/runner/jobs/alpha/enable': {
      before: '502 {"error":"Runner unreachable"}',
      allowedBy: `${D28}: enable is PATCH, as the runner expects, and POST is no longer rewritten; ${D4}`,
      status: 404,
      code: 'SERVER_NOT_FOUND',
    },
    'runner POST /api/runner/jobs/alpha/disable': {
      before: '502 {"error":"Runner unreachable"}',
      allowedBy: `${D28}: disable is PATCH, as the runner expects, and POST is no longer rewritten; ${D4}`,
      status: 404,
      code: 'SERVER_NOT_FOUND',
    },
    'runner GET /api/runner/status': {
      before: '502 {"error":"Runner unreachable"}',
      allowedBy: D4_RUNNER,
      status: 503,
      code: 'SERVER_RUNNER_UNAVAILABLE',
    },
    'runner jobs none': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'runner jobs session': {
      before: '502 {"error":"Runner unreachable"}',
      allowedBy: D4_RUNNER,
      status: 503,
      code: 'SERVER_RUNNER_UNAVAILABLE',
    },
    'runner jobs scoped session': {
      before: '502 {"error":"Runner unreachable"}',
      allowedBy: D4_RUNNER,
      status: 503,
      code: 'SERVER_RUNNER_UNAVAILABLE',
    },
    'runner jobs insider key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'runner jobs machine key': {
      before: '502 {"error":"Runner unreachable"}',
      allowedBy: D4_RUNNER,
      status: 503,
      code: 'SERVER_RUNNER_UNAVAILABLE',
    },
    'runner jobs scoped machine key': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: `${D8_INSIDER}; ${D29}`,
      status: 403,
      code: 'SERVER_FORBIDDEN',
    },
    'runner jobs path share': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'runner unknown route': {
      before: '404 {"error":"Not found"}',
      allowedBy: `${D4}; ${D28}`,
      status: 404,
      code: 'SERVER_NOT_FOUND',
    },
  };
