/**
 * Approved wire departures for file writes and block mutations: each departing scenario, what the branch base sent, and the decision that allows the change. Pure data.
 *
 * @packageDocumentation
 */

import { D_VALIDATION, D4, type WireDeparture } from './departuresCommon.js';

/** Departures of the file writes and block mutations scenarios. */
export const DEPARTURES_WRITE: Readonly<Record<string, WireDeparture>> = {
  'fileWrite none': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'fileWrite path share': {
    before: '403 {"error":"Insider access required"}',
    allowedBy: D4,
    status: 403,
    code: 'SERVER_INSIDER_REQUIRED',
  },
  'fileWrite scoped session out of scope': {
    before: '403 {"error":"Path is outside your access scope"}',
    allowedBy: D4,
    status: 403,
    code: 'SERVER_OUT_OF_SCOPE',
  },
  'fileWrite no content': {
    before: '400 {"error":"Request body must include \\"content\\" string"}',
    allowedBy: `${D4}; ${D_VALIDATION}`,
    status: 400,
    code: 'FST_ERR_VALIDATION',
  },
  'fileWrite non-string content': {
    before: '400 {"error":"Request body must include \\"content\\" string"}',
    allowedBy: `${D4}; ${D_VALIDATION}`,
    status: 400,
    code: 'FST_ERR_VALIDATION',
  },
  'fileWrite directory': {
    before: '400 {"error":"Can only write to files"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_NOT_A_FILE',
  },
  'fileWrite missing': {
    before: '404 {"error":"File not found"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  'fileWrite no root': {
    before: '404 {"error":"Invalid path"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  'fileMutate toggle-checkbox out of range': {
    before: '400 {"error":"Checkbox index 9 out of range"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_REQUEST',
  },
  'fileMutate toggle-checkbox bad body': {
    before:
      '400 {"error":"toggle-checkbox requires index (number) and checked (boolean)"}',
    allowedBy: `${D4}; ${D_VALIDATION}`,
    status: 400,
    code: 'FST_ERR_VALIDATION',
  },
  'fileMutate edit-block reversed': {
    before: '400 {"error":"startLine must not exceed endLine"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_REQUEST',
  },
  'fileMutate edit-block out of bounds': {
    before: '400 {"error":"Line range out of bounds"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_REQUEST',
  },
  'fileMutate edit-block empty content': {
    before: '400 {"error":"content must not be empty"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_REQUEST',
  },
  'fileMutate edit-block missing fields': {
    before:
      '400 {"error":"edit-block requires startLine, endLine, and content"}',
    allowedBy: `${D4}; ${D_VALIDATION}`,
    status: 400,
    code: 'FST_ERR_VALIDATION',
  },
  'fileMutate delete-block missing fields': {
    before: '400 {"error":"delete-block requires startLine and endLine"}',
    allowedBy: `${D4}; ${D_VALIDATION}`,
    status: 400,
    code: 'FST_ERR_VALIDATION',
  },
  'fileMutate insert-block bad position': {
    before:
      '400 {"error":"insert-block requires atLine, content, and position (before|after)"}',
    allowedBy: `${D4}; ${D_VALIDATION}`,
    status: 400,
    code: 'FST_ERR_VALIDATION',
  },
  'fileMutate insert-block out of bounds': {
    before: '400 {"error":"atLine out of bounds"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_REQUEST',
  },
  'fileMutate edit-cell separator': {
    before: '400 {"error":"Cannot edit a separator row"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_REQUEST',
  },
  'fileMutate edit-cell bad column': {
    before: '400 {"error":"Column index out of bounds"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_REQUEST',
  },
  'fileMutate edit-cell missing fields': {
    before: '400 {"error":"edit-cell requires line, col, and content"}',
    allowedBy: `${D4}; ${D_VALIDATION}`,
    status: 400,
    code: 'FST_ERR_VALIDATION',
  },
  'fileMutate no action': {
    before: '400 {"error":"Missing action field"}',
    allowedBy: `${D4}; ${D_VALIDATION}`,
    status: 400,
    code: 'FST_ERR_VALIDATION',
  },
  'fileMutate unknown action': {
    before: '400 {"error":"Unknown action: explode"}',
    allowedBy: `${D4}; ${D_VALIDATION}`,
    status: 400,
    code: 'FST_ERR_VALIDATION',
  },
  'fileMutate array body': {
    before: '400 {"error":"Missing action field"}',
    allowedBy: `${D4}; ${D_VALIDATION}`,
    status: 400,
    code: 'FST_ERR_VALIDATION',
  },
  'fileMutate not markdown': {
    before: '400 {"error":"Only .md files are supported"}',
    allowedBy: D4,
    status: 400,
    code: 'SERVER_INVALID_REQUEST',
  },
  'fileMutate missing': {
    before: '404 {"error":"File not found"}',
    allowedBy: D4,
    status: 404,
    code: 'SERVER_NOT_FOUND',
  },
  'fileMutate none': {
    before: '401 {"error":"Unauthorized"}',
    allowedBy: D4,
    status: 401,
    code: 'SERVER_UNAUTHORIZED',
  },
  'fileMutate path share': {
    before: '403 {"error":"Insider access required"}',
    allowedBy: D4,
    status: 403,
    code: 'SERVER_INSIDER_REQUIRED',
  },
  'fileMutate scoped session out of scope': {
    before: '403 {"error":"Path is outside your access scope"}',
    allowedBy: D4,
    status: 403,
    code: 'SERVER_OUT_OF_SCOPE',
  },
};
