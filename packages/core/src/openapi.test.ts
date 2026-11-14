/**
 * The committed OpenAPI document: in step with `SERVER_CATALOG` (drift; run `npm run openapi`), a valid OpenAPI 3.1 document with one operation per entry, security per access class and the core version, exported and published as a sub-path, regenerated after a release bump.
 */

import { readFileSync } from 'node:fs';

import { checkOpenApiDrift } from '@karmaniverous/jeeves/openapi';
import { Validator } from '@seriousme/openapi-schema-validator';
import { describe, expect, it } from 'vitest';

import { OPENAPI_FILE, openApiInfo } from '../scripts/openapiInfo.js';
import { SERVER_CATALOG } from './catalog/serverCatalog.js';
import * as root from './index.js';
import { SERVER_OPENAPI_DOCUMENT } from './openapi.js';

interface Operation {
  operationId: string;
  security?: Record<string, unknown>[];
  'x-jeeves-insider-only'?: boolean;
}

interface Doc {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, Operation>>;
}

const doc = SERVER_OPENAPI_DOCUMENT as unknown as Doc;
const operations = Object.entries(doc.paths).flatMap(([path, methods]) =>
  Object.entries(methods).map(([method, op]) => ({ path, method, ...op })),
);
const byId = (id: string) => operations.find((op) => op.operationId === id);

const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as {
  version: string;
  files: string[];
  exports: Record<string, unknown>;
  dependencies?: Record<string, string>;
  scripts: Record<string, string>;
  'release-it': { hooks: Record<string, string[]> };
};

describe('openapi.json', () => {
  it('matches SERVER_CATALOG (run `npm run openapi` after changing the catalog)', () => {
    const result = checkOpenApiDrift(
      SERVER_CATALOG,
      openApiInfo(),
      OPENAPI_FILE,
    );
    expect(result.diff).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  it('is a valid OpenAPI 3.1 document', async () => {
    expect(doc.openapi).toMatch(/^3\.1\./);
    const result = await new Validator().validate(
      structuredClone(SERVER_OPENAPI_DOCUMENT),
    );
    expect(result.errors).toBeUndefined();
    expect(result.valid).toBe(true);
  });

  it('is exported verbatim as SERVER_OPENAPI_DOCUMENT, also from the package entry', () => {
    expect(SERVER_OPENAPI_DOCUMENT).toEqual(
      JSON.parse(readFileSync(OPENAPI_FILE, 'utf8')),
    );
    expect(root.SERVER_OPENAPI_DOCUMENT).toBe(SERVER_OPENAPI_DOCUMENT);
  });

  it('carries the core version and title', () => {
    expect(doc.info).toMatchObject({
      title: 'jeeves-server',
      version: pkg.version,
    });
  });

  it('has one operation per catalog entry, at its method and path', () => {
    const toOpenApiPath = (path: string) =>
      path.replace(/:(\w+)/g, '{$1}').replace('*', '{*}');
    expect(
      operations.map((op) => [op.operationId, op.method, op.path]).sort(),
    ).toEqual(
      SERVER_CATALOG.entries
        .map((e) => [e.name, e.method.toLowerCase(), toOpenApiPath(e.path)])
        .sort(),
    );
  });

  it('documents the credentials of each access class', () => {
    expect(byId('status')?.security).toEqual([]);
    expect(byId('browse')?.security).toEqual([
      { query_k: [] },
      { cookie_jeeves_session: [] },
    ]);
    expect(byId('browse')).not.toHaveProperty('x-jeeves-insider-only');
    expect(byId('config')?.['x-jeeves-insider-only']).toBe(true);
    expect(byId('pathKey')?.security).toEqual([{ header_X_API_Key: [] }]);
    expect(byId('receiveEvent')?.security).toEqual([{ query_k: [] }]);
  });
});

describe('package.json', () => {
  it('publishes openapi.json and the catalog as sub-path exports', () => {
    expect(pkg.files).toContain('openapi.json');
    expect(pkg.exports['./openapi.json']).toBe('./openapi.json');
    expect(pkg.exports['./catalog']).toEqual({
      import: {
        types: './dist/src/catalog/index.d.ts',
        default: './dist/src/catalog/index.js',
      },
    });
  });

  it('regenerates openapi.json after each release bump, then rebuilds', () => {
    expect(pkg.scripts.openapi).toBe('tsx scripts/write-openapi.ts');
    const hooks = pkg['release-it'].hooks['after:bump'];
    // dist inlines the document, so it must be rebuilt after regeneration
    // or the published SERVER_OPENAPI_DOCUMENT carries the old version.
    expect(hooks.indexOf('npm run openapi')).toBeGreaterThanOrEqual(0);
    expect(hooks.indexOf('npm run build')).toBeGreaterThan(
      hooks.indexOf('npm run openapi'),
    );
  });

  it('keeps core free of Fastify and zod-openapi at run time', () => {
    expect(Object.keys(pkg.dependencies ?? {})).not.toContain('fastify');
    expect(Object.keys(pkg.dependencies ?? {})).not.toContain('zod-openapi');
  });
});
