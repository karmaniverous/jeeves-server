/**
 * Hand-written parameters of the composed sharing tools (each spans more than one catalog entry): `server_share` exactly as in 0.15.0, `server_export` with the full format list and the `share` option (Decisions 19 and 21).
 *
 * @packageDocumentation
 */

import { BROWSE_PATH_DESCRIPTION } from './constants.js';
import { EXPORT_FORMATS } from './exportFormats.js';

/** `server_share` parameters (unchanged from 0.15.0). */
export const SERVER_SHARE_PARAMETERS: Record<string, unknown> = {
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: BROWSE_PATH_DESCRIPTION,
    },
    expiryDays: {
      type: 'number',
      description:
        'Link expiry in days. Omitted: no expiry is sent and the link never expires',
    },
    depth: {
      type: 'number',
      description:
        'Links the outsider may follow from the shared page, making a deep share (0 or omitted: a document opens on its own; a directory covers its whole tree)',
    },
    dirs: {
      type: 'boolean',
      description: 'Include directory listings in deep share (default: false)',
    },
    insiders: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Email addresses of target audience insiders. When provided, uses the share-for endpoint.',
    },
    enforceOutsiderPolicy: {
      type: 'boolean',
      description:
        'Whether to enforce outsider policy when sharing (default: true)',
    },
  },
  required: ['path'],
};

/** `server_export` parameters. */
export const SERVER_EXPORT_PARAMETERS: Record<string, unknown> = {
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: BROWSE_PATH_DESCRIPTION,
    },
    format: {
      type: 'string',
      description: `Export format: ${EXPORT_FORMATS.join(', ')}`,
      enum: EXPORT_FORMATS,
    },
    share: {
      type: 'object',
      description:
        'Sign a share for the path and derive the URL from it, so someone without a session can download the export. Files only: directory archives (zip, tar) are insider-only, so share with them is an error. Omitted: the URL carries no credential.',
      properties: {
        expiryDays: {
          type: 'number',
          description: 'Share expiry in days. Omitted: the share never expires',
        },
      },
      additionalProperties: false,
    },
  },
  required: ['path', 'format'],
};
