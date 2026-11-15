/**
 * Renders the API reference (`guides/api-reference.md`) from the endpoint catalog: one section per `SERVER_CATALOG` entry with its method, path, access class (`ROUTE_ACCESS`), description, parameters and response, read from the generated OpenAPI document. Shared by the writer (`write-api-reference.ts`) and the drift test. Pure apart from `API_REFERENCE_FILE`'s location.
 *
 * @packageDocumentation
 */

import { fileURLToPath } from 'node:url';

import {
  SERVER_CATALOG,
  SERVER_OPENAPI_DOCUMENT,
  shareQuerySchema,
} from '@karmaniverous/jeeves-server-core';

import { type AccessClass, routeAccess } from '../src/api/routeAccess.js';

/** The committed reference. */
export const API_REFERENCE_FILE = fileURLToPath(
  new URL('../guides/api-reference.md', import.meta.url),
);

/** The subset of JSON Schema the reference reads. */
interface Schema {
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  items?: Schema;
  anyOf?: Schema[];
  oneOf?: Schema[];
  $ref?: string;
  format?: string;
  description?: string;
  properties?: Record<string, Schema>;
  required?: string[];
}

interface Parameter {
  in: string;
  name: string;
  required?: boolean;
  description?: string;
  schema: Schema;
}

interface Operation {
  parameters?: Parameter[];
  requestBody?: { content: Record<string, { schema: Schema }> };
  responses: Partial<
    Record<string, { content?: Record<string, { schema: Schema }> }>
  >;
}

const PATHS = (
  SERVER_OPENAPI_DOCUMENT as unknown as {
    paths: Partial<Record<string, Partial<Record<string, Operation>>>>;
  }
).paths;

/** Query parameters of a share link, other than `k`: listed once. */
const SHARE_PARAMS = new Set(Object.keys(shareQuerySchema.shape));

/** Who may call each access class (Decision 8). */
const ACCESS_TEXT: Record<AccessClass, string> = {
  public: 'anyone (a credential, when sent, is resolved but never refused)',
  navigation:
    'an identity, or a share credential for the path; the path or a non-denied ancestor of an allowed pattern must be in scope',
  content:
    'an identity, or a share credential for the path; the path itself must be in scope',
  'content+insider':
    'an identity (session or insider/machine key) whose scopes cover the path; share credentials are refused',
  insider:
    'an identity (session or insider/machine key); every path the request addresses must be in its scopes',
  admin:
    'an identity with no scopes configured (an unscoped insider session or machine key)',
  machineSeed: 'the raw machine seed in the `X-API-Key` header',
  eventKey: 'a machine key valid for `/event`, as `k`',
};

/** Escapes text for a Markdown table cell. */
const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');

/**
 * A JSON Schema as a short TypeScript-like type.
 *
 * @param schema - The schema.
 * @returns The type text.
 */
function typeText(schema: Schema): string {
  if (schema.$ref) return schema.$ref.split('/').pop() ?? 'unknown';
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (schema.enum) return schema.enum.map((v) => JSON.stringify(v)).join(' | ');
  const union = schema.anyOf ?? schema.oneOf;
  if (union) return [...new Set(union.map(typeText))].join(' | ');
  if (schema.format === 'binary') return 'binary';
  const types = Array.isArray(schema.type)
    ? schema.type
    : schema.type
      ? [schema.type]
      : [];
  if (types.length === 0) return 'unknown';
  return types
    .map((t) =>
      t === 'array'
        ? `${schema.items ? typeText(schema.items) : 'unknown'}[]`
        : t,
    )
    .join(' | ');
}

/** Rows of a field table. */
type Row = [string, string, string, string];

function fieldTable(header: Row, rows: Row[]): string[] {
  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ];
}

function propertyRows(schema: Schema, where: string): Row[] {
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties ?? {}).map(([name, prop]) => [
    `\`${name}\``,
    where,
    `\`${typeText(prop)}\`${required.has(name) ? '' : ' (optional)'}`,
    prop.description ?? '',
  ]);
}

function requestLines(op: Operation, sharesPath: boolean): string[] {
  const rows: Row[] = (op.parameters ?? [])
    .filter((p) => !(p.in === 'query' && SHARE_PARAMS.has(p.name)))
    .map((p) => [
      `\`${p.name}\``,
      p.in,
      `\`${typeText(p.schema)}\`${p.required ? '' : ' (optional)'}`,
      p.description ?? p.schema.description ?? '',
    ]);
  const body = op.requestBody?.content['application/json']?.schema;
  if (body) rows.push(...propertyRows(body, 'body'));
  const lines =
    rows.length > 0
      ? [
          '**Request:**',
          '',
          ...fieldTable(['Field', 'In', 'Type', 'Description'], rows),
          '',
        ]
      : [];
  if (sharesPath)
    lines.push(
      'Also accepts the share-link query parameters (`k`, `exp`, `d`, `dirs`, `s`); see [Share credentials](#share-credentials).',
      '',
    );
  return lines;
}

function responseLines(op: Operation): string[] {
  const content = op.responses['200']?.content ?? {};
  const first = Object.entries(content).at(0);
  if (!first) return ['**Response:** empty.', ''];
  const [mediaType, media] = first;
  if (mediaType !== 'application/json')
    return [`**Response:** \`${mediaType}\` bytes.`, ''];
  const rows = propertyRows(media.schema, '').map(
    ([name, , type, description]): [string, string, string] => [
      name,
      type,
      description,
    ],
  );
  if (rows.length === 0)
    return [`**Response:** \`${typeText(media.schema)}\` (JSON).`, ''];
  return [
    '**Response** (JSON):',
    '',
    '| Field | Type | Description |',
    '| --- | --- | --- |',
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
    '',
  ];
}

const HEADER = `---
title: API Reference
---

<!-- Generated from SERVER_CATALOG by \`npm run api-reference\` (packages/service). Do not edit: the drift test fails until the file is regenerated. -->

# API Reference

Every machine-API route of jeeves-server is an entry of its endpoint catalog, \`SERVER_CATALOG\` in \`@karmaniverous/jeeves-server-core\`. This page is generated from it. The same catalog yields \`GET /openapi.json\` (served without credentials, also shipped as \`@karmaniverous/jeeves-server-core/openapi.json\`), the SDK (\`createServerClient\` in \`@karmaniverous/jeeves-server-sdk\`, one method per entry, named as the headings below) and the OpenClaw plugin's tools.

- **Requests are validated** against the entry's schemas; a request that fails gets \`400\` with code \`FST_ERR_VALIDATION\`.
- **Errors** share one body, \`{ statusCode, code?, error, message }\`; the \`SERVER_*\` codes are listed in [API & Integration: Errors](./api-integration.md#errors).
- **Credentials:** an insider, machine or share key as the \`k\` query parameter, or the \`jeeves_session\` cookie; the key-exchange routes (\`/key\`, \`/insider-key\`) take the raw machine seed in \`X-API-Key\`. Each entry's **Access** line says which it accepts (see [Insiders, Outsiders & Sharing](./sharing.md)).

## Share credentials

Navigation and content entries also accept a share link's query parameters: \`k\` (the path key), \`exp\` (expiry, Unix ms, for expiring links), \`d\`, \`dirs\` and \`s\` (deep shares) and \`key\` (legacy name of \`k\`). A share link's parameters work unchanged on every route under the same path: replace \`/browse/\` with \`/api/raw/\` or \`/api/export/\` and keep the query string.

`;

/**
 * The API reference's Markdown.
 *
 * @returns The document.
 */
export function renderApiReference(): string {
  const entries = SERVER_CATALOG.entries;
  const lines: string[] = [
    '## Entries',
    '',
    '| Entry | Method | Path | Access |',
    '| --- | --- | --- | --- |',
    ...entries.map(
      (e) =>
        `| [\`${e.name}\`](#${e.name.toLowerCase()}) | \`${e.method}\` | \`${e.path}\` | ${routeAccess(e.name).class} |`,
    ),
    '',
  ];
  for (const entry of entries) {
    const openApiPath = entry.path
      .replace(/:(\w+)/g, '{$1}')
      .replace('*', '{*}');
    const op = PATHS[openApiPath]?.[entry.method.toLowerCase()];
    if (!op) throw new Error(`No OpenAPI operation for ${entry.name}`);
    const access = routeAccess(entry.name);
    const sharesPath =
      access.class === 'navigation' || access.class === 'content';
    lines.push(
      `### ${entry.name}`,
      '',
      `\`${entry.method} ${entry.path}\``,
      '',
      entry.description,
      '',
      `**Access:** \`${access.class}\`: ${ACCESS_TEXT[access.class]}${
        access.loginSeedKey ? '; also the insider-seed insider key' : ''
      }${access.noScopedMachineKey ? '; never a machine key with scopes' : ''}.`,
      '',
      ...requestLines(op, sharesPath),
      ...responseLines(op),
    );
  }
  return `${HEADER}${lines.join('\n').trimEnd()}\n`;
}
