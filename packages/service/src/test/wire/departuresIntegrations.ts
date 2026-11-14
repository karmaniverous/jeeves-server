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
      allowedBy: D8_INSIDER,
      status: 200,
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
      allowedBy: D8_INSIDER,
      status: 200,
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
      allowedBy: D4_RUNNER,
      status: 503,
      code: 'SERVER_RUNNER_UNAVAILABLE',
    },
    'runner POST /api/runner/jobs/alpha/disable': {
      before: '502 {"error":"Runner unreachable"}',
      allowedBy: D4_RUNNER,
      status: 503,
      code: 'SERVER_RUNNER_UNAVAILABLE',
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
      allowedBy: D8_INSIDER,
      status: 503,
      code: 'SERVER_RUNNER_UNAVAILABLE',
    },
    'runner jobs path share': {
      before: '401 {"error":"Unauthorized"}',
      allowedBy: D4,
      status: 401,
      code: 'SERVER_UNAUTHORIZED',
    },
    'runner unknown route': {
      before: '404 {"error":"Not found"}',
      allowedBy: `${D4}; the catalog's runner entries pass every /api/runner/* path through, so an unknown path is the runner's answer (here: runner unreachable)`,
      status: 503,
      code: 'SERVER_RUNNER_UNAVAILABLE',
    },
  };
