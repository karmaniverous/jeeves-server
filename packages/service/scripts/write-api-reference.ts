/**
 * Writes `guides/api-reference.md` from `SERVER_CATALOG`. Run with `npm run api-reference` (packages/service) after changing the catalog or `ROUTE_ACCESS`; the drift test fails until you do.
 *
 * @packageDocumentation
 */

import { writeFileSync } from 'node:fs';

import { API_REFERENCE_FILE, renderApiReference } from './apiReference.js';

writeFileSync(API_REFERENCE_FILE, renderApiReference());
console.log(`Wrote ${API_REFERENCE_FILE}`);
