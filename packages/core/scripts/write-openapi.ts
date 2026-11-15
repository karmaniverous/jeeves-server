/**
 * Writes jeeves-server-core's `openapi.json` from `SERVER_CATALOG`. Run with `npm run openapi` after changing the catalog (the drift test fails until you do); release-it runs it after each version bump. The build never writes it.
 *
 * @packageDocumentation
 */

import { writeOpenApiDocument } from '@karmaniverous/jeeves/openapi';

import { SERVER_CATALOG } from '../src/catalog/serverCatalog.js';
import { OPENAPI_FILE, openApiInfo } from './openapiInfo.js';

writeOpenApiDocument(SERVER_CATALOG, openApiInfo(), OPENAPI_FILE);
console.log(`Wrote ${OPENAPI_FILE}`);
