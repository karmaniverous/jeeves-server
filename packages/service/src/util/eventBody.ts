/**
 * Size cap for unmatched event bodies stored in the event log. Pure.
 *
 * @packageDocumentation
 */

import { type EventLogEntry, MAX_STORED_BODY_BYTES } from '../config/types.js';

/**
 * Body fields for an event log entry: the body JSON in full up to
 * `maxBytes` (default {@link MAX_STORED_BODY_BYTES}), otherwise cut at the
 * cap on a character boundary, with `truncated` and the original UTF-8
 * byte length recorded.
 */
export function storedBody(
  bodyJson: string,
  maxBytes = MAX_STORED_BODY_BYTES,
): Pick<EventLogEntry, 'bodyPreview' | 'truncated' | 'originalBytes'> {
  const bytes = Buffer.from(bodyJson, 'utf8');
  if (bytes.length <= maxBytes) return { bodyPreview: bodyJson };
  // A multi-byte character split at the cap decodes to U+FFFD; drop it.
  const cut = bytes
    .subarray(0, maxBytes)
    .toString('utf8')
    .replace(/\uFFFD+$/u, '');
  return { bodyPreview: cut, truncated: true, originalBytes: bytes.length };
}
