/**
 * Approved wire departures for config, key exchange, legacy, webhook, sign-in, SPA and unknown routes: each departing scenario, what the branch base sent, and the decision that allows the change. Pure data.
 *
 * @packageDocumentation
 */

import { D4, D11, D17, D22, type WireDeparture } from './departuresCommon.js';

/** Departures of the config, key exchange, legacy, webhook, sign-in, SPA and unknown routes scenarios. */
export const DEPARTURES_SERVICE: Readonly<Record<string, WireDeparture>> = {
  // jeeves-owned handler (`createConfigQueryHandler`): jeeves 0.10.0 sends
  // Fastify's standard error body for an invalid JSONPath.
  'config invalid jsonpath': {
    before:
      '400 {"error":"Unclosed ( at character 3"} from @karmaniverous/jeeves 0.7.0',
    allowedBy: D11,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  // jeeves-owned handler (`createConfigApplyHandler`): jeeves 0.10.0 folds
  // the Zod issues into `message` of Fastify's standard error body.
  'configApply invalid config': {
    before:
      '400 {"error":"Config validation failed","issues":[{"expected":"number","code":"invalid_type","path":["port"],"message":"Invalid input: expected number, received string"}]} from @karmaniverous/jeeves 0.7.0',
    allowedBy: D11,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  // T7: every JSON error reply of the service (#315).
  'configApply empty body': {
    before:
      '500 {"statusCode":500,"error":"Internal Server Error","message":"Cannot convert undefined or null to object"}',
    allowedBy: D11,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'configApply no body': {
    before:
      '500 {"statusCode":500,"error":"Internal Server Error","message":"Cannot destructure property \'patch\' of \'request\' as it is undefined."}',
    allowedBy: D11,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'pathKey no path': {
    before: '400 {"error":"path query param required"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_REQUEST',
  },
  'pathKey unknown key': {
    before: '401 {"error":"Invalid API key"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'pathKey none': {
    before: '401 {"error":"X-API-Key header required"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'pathKey insider key in query': {
    before: '401 {"error":"X-API-Key header required"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'insiderKey unknown key': {
    before: '401 {"error":"Invalid API key"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'insiderKey none': {
    before: '401 {"error":"X-API-Key header required"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'receiveEvent none': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'receiveEvent bad key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'receiveEvent scoped machine key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'receiveEvent insider key': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'auth callback code': {
    before:
      '500 {"statusCode":500,"error":"Internal Server Error","message":"fetch failed"}',
    allowedBy: D4,
    status: 500,
  },
  'spa asset missing': {
    before: '404 {"error":"Not found"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  'unknown route': {
    before: '404 {"error":"Not found"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  'unknown route POST': {
    before: '404 {"error":"Not found"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  'unknown route POST under browse': {
    before: '404 {"error":"Not found"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  'unknown api route': {
    before: '404 {"error":"Not found"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  'unknown api route none': {
    before: '404 {"error":"Not found"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  status: {
    before:
      '200 with health.events[].cmd and health.chrome.path, without redirect URIs',
    allowedBy: `${D22}; ${D17}`,
    status: 200,
  },
  'status insider key': {
    before:
      '200 with health.events[].cmd and health.chrome.path (an insider-seed key is no identity on public routes)',
    allowedBy: `${D22}; ${D17}`,
    status: 200,
  },
  config: {
    before: '200 the redacted config, without credentials',
    allowedBy: D11,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'config jsonpath': {
    before: '200 {"result":[1934],"count":1}, without credentials',
    allowedBy: D11,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'config jsonpath no match': {
    before: '200 {"result":[],"count":0}, without credentials',
    allowedBy: D11,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'configApply unknown key': {
    before: '200 {"applied":true,"config":{...}}, without credentials',
    allowedBy: D11,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'configApply valid patch (temp config)': {
    before: '200 {"applied":true,"config":{...}}, without credentials',
    allowedBy: D11,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
};
