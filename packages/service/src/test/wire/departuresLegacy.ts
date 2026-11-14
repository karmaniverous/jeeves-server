/**
 * Approved wire departures for the removed legacy routes (`POST /rotate-key`, `GET /share`; #292, Decision 20), now unknown routes (404), and for the one rotation route's added `invalidates`. Pure data.
 *
 * @packageDocumentation
 */

import { D20, type WireDeparture } from './departuresCommon.js';

/** A legacy scenario: what the base sent; now an unknown route. */
const removed = (before: string): WireDeparture => ({
  before,
  allowedBy: `${D20}: the route is removed (404)`,
  status: 404,
  code: 'SERVER_NOT_FOUND',
});

const ROTATED = '200 {"ok":true,"keyName":"admin@wire.test"}';
const UNAUTHORIZED = '401 {"error":"Invalid insider key"}';
const SHARED =
  '200 {"path":"/{root}/doc.md","key":"{key}","exp":null,"url":"/browse/{root}/doc.md?k={key}"}';

/** A rotation the one rotation route answers, now with `invalidates`. */
const rotated: WireDeparture = {
  before: '200 {"ok":true,"keyCreatedAt":"{ts}"}',
  allowedBy: `${D20}: the response adds invalidates: ['insiderKey', 'outsiderLinks']`,
  status: 200,
};

/** Departures of the legacy route scenarios and of rotateKey's successes. */
export const DEPARTURES_LEGACY: Readonly<Record<string, WireDeparture>> = {
  'legacy rotateKey insider key': removed(ROTATED),
  'legacy rotateKey session': removed(ROTATED),
  'legacy rotateKey machine key': removed(
    '501 {"error":"Machine key rotation is not supported with TypeScript config. Update the key manually in jeeves.config.ts and restart the server."}',
  ),
  'legacy rotateKey bad key': removed(UNAUTHORIZED),
  'legacy rotateKey none': removed(UNAUTHORIZED),
  'legacy share insider key': removed(SHARED),
  'legacy share insider key expiring': removed(
    '200 {"path":"/{root}/doc.md","key":"{key}","exp":"4102444800000","url":"/browse/{root}/doc.md?k={key}&exp=4102444800000"}',
  ),
  'legacy share session': removed(SHARED),
  'legacy share machine key': removed(SHARED),
  'legacy share scoped insider key out of scope': removed(SHARED),
  'legacy share no path': removed('400 {"error":"path query param required"}'),
  'legacy share bad key': removed(UNAUTHORIZED),
  'legacy share none': removed(UNAUTHORIZED),
  'rotateKey session': rotated,
  'rotateKey scoped session': rotated,
};
