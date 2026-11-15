/**
 * Approved wire departures for share URLs: the `/browse` URL that `POST /api/share` and `POST /api/util/share-for` return now carries the target path percent-encoded segment by segment (a space as `%20`, `%` as `%25`), so a name holding `%`, `#` or `?` makes a working link. The key and the `path` field are unchanged. Pure data.
 *
 * @packageDocumentation
 */

import type { WireDeparture } from './departuresCommon.js';

/** T22 second review: share URLs encode each path segment. */
const SHARE_URL_ENCODED =
  'T22 second review (owner-approved plan): share URLs carry the path percent-encoded per segment (services/shareLinks.ts, encodeUrlPath), as deep-share navigation links already did; the key still covers the decoded path';

/** A share reply whose URL path now percent-encodes a space or `%`. */
const encodedUrl = (example: string): WireDeparture => ({
  before: `200 with the raw path in url (${example})`,
  allowedBy: SHARE_URL_ENCODED,
  status: 200,
});

/** Departures of the share scenarios whose target has a space or `%`. */
export const DEPARTURES_SHARE_URL: Readonly<Record<string, WireDeparture>> = {
  'share deep': encodedUrl('/browse/{root}/sub dir?...'),
  'share directory': encodedUrl('/browse/{root}/sub dir?...'),
  'share directory trailing slash': encodedUrl('/browse/{root}/sub dir/?...'),
  'share percent name': encodedUrl('/browse/{root}/sub dir/100% done.md?...'),
  'shareFor directory tree': encodedUrl('/browse/{root}/sub dir?...'),
  'shareFor deep': encodedUrl('/browse/{root}/sub dir?...'),
};
