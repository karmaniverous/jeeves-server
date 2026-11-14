/**
 * Location and `info` block of jeeves-server-core's committed OpenAPI document (`openapi.json`), shared by the writer (`write-openapi.ts`) and the drift test. Reads `package.json`; no writes.
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { OpenApiInfo } from '@karmaniverous/jeeves/openapi';

/** The committed document. */
export const OPENAPI_FILE = fileURLToPath(
  new URL('../openapi.json', import.meta.url),
);

/**
 * The document's `info`: title, jeeves-server-core's current version,
 * description.
 *
 * @returns OpenAPI `info`.
 */
export function openApiInfo(): OpenApiInfo {
  const pkg = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as { version: string };
  return {
    title: 'jeeves-server',
    version: pkg.version,
    description:
      'Machine API of the jeeves-server service: the routes in its endpoint catalog (SERVER_CATALOG). Credentials: an insider, machine or share key as the k query parameter, or the jeeves_session cookie; the key-exchange routes take the raw machine seed in X-API-Key. Operations marked x-jeeves-insider-only refuse share credentials.',
  };
}
