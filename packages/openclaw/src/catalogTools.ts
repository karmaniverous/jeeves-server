/**
 * The catalog tools: each tool's definition comes from its `SERVER_CATALOG` entry (`catalogToolDefinition`, the `*` path exposed as `path`), without the share-credential query parameters the plugin never sends; each call goes through the entry's SDK method with the plugin's key (none for the public `authStatus`).
 *
 * @packageDocumentation
 */

import type { ToolDescriptor } from '@karmaniverous/jeeves';
import { catalogToolDefinition } from '@karmaniverous/jeeves/catalog';
import {
  SERVER_CATALOG,
  type ServerEntryName,
  shareQuerySchema,
} from '@karmaniverous/jeeves-server-core/catalog';

import { BROWSE_PATH_DESCRIPTION } from './constants.js';
import { runServerCall, type ToolContext } from './sdkCall.js';

/** Tool name prefix. */
const PREFIX = 'server';

/** The `*` path parameter's tool name. */
const PATH_ALIAS = 'path';

/**
 * Share-credential query fields (`exp`, `d`, `dirs`, `s`, `key`): the plugin
 * authenticates with its own key and never sends them, so they are not tool
 * parameters.
 */
const SHARE_FIELDS: readonly string[] = Object.keys(shareQuerySchema.shape);

/** One catalog tool. */
interface CatalogToolConfig {
  /** Catalog entry (its SDK method). */
  entry: ServerEntryName;
  /** Further entry fields that are not tool parameters. */
  omit?: readonly string[];
  /** Send the plugin's key (default true). */
  withKey?: boolean;
}

/** The catalog tools, in their 0.15.0 registration order. */
export const CATALOG_TOOLS: readonly CatalogToolConfig[] = [
  { entry: 'linkInfo' },
  { entry: 'browse' },
  { entry: 'fileWrite' },
  { entry: 'fileMutate' },
  { entry: 'exportCacheClear' },
  { entry: 'drives' },
  // Public: sent without the key, as in 0.15.0. `path` is the path a share
  // credential is checked against, which the plugin never sends.
  { entry: 'authStatus', omit: ['path'], withKey: false },
  { entry: 'resolvePath' },
];

/** Whether an entry has a `*` path parameter. */
const hasWildcard = (entry: ServerEntryName): boolean =>
  SERVER_CATALOG.byName(entry).path.includes('*');

/**
 * Tool parameters of a catalog tool: the entry's tool definition without
 * the share-credential fields and the tool's `omit` fields, its `*` path
 * (`path`) described as a browse path (#320).
 *
 * @param config - The tool.
 * @returns Name, description and JSON Schema of the parameters.
 */
export function catalogToolDefinitionFor(config: CatalogToolConfig): {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
} {
  const wildcard = hasWildcard(config.entry);
  const { name, description, inputSchema } = catalogToolDefinition(
    SERVER_CATALOG.byName(config.entry),
    {
      prefix: PREFIX,
      ...(wildcard ? { inputAliases: { '*': PATH_ALIAS } } : {}),
    },
  );
  const dropped = new Set([...SHARE_FIELDS, ...(config.omit ?? [])]);
  const properties = Object.fromEntries(
    Object.entries(inputSchema['properties'] as Record<string, unknown>)
      .filter(([field]) => !dropped.has(field))
      .map(([field, schema]) =>
        wildcard && field === PATH_ALIAS
          ? [
              field,
              { ...(schema as object), description: BROWSE_PATH_DESCRIPTION },
            ]
          : [field, schema],
      ),
  );
  const required = (
    (inputSchema['required'] as string[] | undefined) ?? []
  ).filter((field) => !dropped.has(field));
  const parameters: Record<string, unknown> = { ...inputSchema, properties };
  if (required.length === 0) delete parameters['required'];
  else parameters['required'] = required;
  return { name, description, parameters };
}

/**
 * SDK input from tool parameters: the declared parameters, with `path` as
 * the entry's `*` field (leading slashes stripped).
 *
 * @param config - The tool.
 * @param parameters - The tool's parameter names.
 * @param params - Tool parameters.
 * @returns The input.
 */
function toInput(
  config: CatalogToolConfig,
  parameters: readonly string[],
  params: Record<string, unknown>,
): Record<string, unknown> {
  const wildcard = hasWildcard(config.entry);
  const input: Record<string, unknown> = {};
  for (const name of parameters) {
    const value = params[name];
    if (value === undefined) continue;
    if (wildcard && name === PATH_ALIAS)
      input['*'] =
        typeof value === 'string' ? value.replace(/^\/+/, '') : value;
    else input[name] = value;
  }
  return input;
}

/**
 * Build the catalog tools.
 *
 * @param context - Plugin API and public URL.
 * @returns The tools, in registration order.
 */
export function createCatalogTools(context: ToolContext): ToolDescriptor[] {
  return CATALOG_TOOLS.map((config) => {
    const definition = catalogToolDefinitionFor(config);
    const names = Object.keys(
      definition.parameters['properties'] as Record<string, unknown>,
    );
    return {
      ...definition,
      execute: (_id, params) =>
        runServerCall(
          context,
          (client) =>
            (client[config.entry] as (input: unknown) => Promise<unknown>)(
              toInput(config, names, params),
            ),
          { withKey: config.withKey !== false },
        ),
    };
  });
}
