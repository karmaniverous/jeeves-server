/**
 * How a tool calls the server: one SDK client per call (base URL and key resolved from plugin config at call time), the result passed through public-URL rewriting, and every failure turned into a tool error. Network I/O via the SDK.
 *
 * @packageDocumentation
 */

import {
  connectionFail,
  fail,
  ok,
  type PluginApi,
  type ToolDescriptor,
  type ToolResult,
} from '@karmaniverous/jeeves';
import {
  createServerClient,
  isServerError,
  type ServerClient,
} from '@karmaniverous/jeeves-server-sdk';

import { PLUGIN_ID } from './constants.js';
import { getPluginInsiderKey, getServiceUrl } from './helpers.js';
import { type PublicUrlResolver, rewriteUrlsInData } from './toolUtils.js';

/** What every tool needs: the plugin API (config) and the public URL. */
export interface ToolContext {
  /** Plugin API, read on every call. */
  api: PluginApi;
  /** The server's public URL, resolved on every call. */
  publicUrl: PublicUrlResolver;
}

/** A server call made by a tool. */
export type ServerCall = (
  client: ServerClient,
  baseUrl: string,
) => Promise<unknown>;

/** Options of {@link runServerCall}. */
export interface ServerCallOptions {
  /** Send the plugin's key (default true; `false` for public entries). */
  withKey?: boolean;
}

/**
 * Tool result for a failed call: `HTTP <status>: <message> (<code>)` for an
 * error response, the `apiUrl` guidance when the server can't be reached,
 * `Error: <message>` otherwise (invalid input, a tool's own check).
 *
 * @param error - What the call threw.
 * @param baseUrl - The URL the call used.
 * @returns The error result.
 */
export function toolError(error: unknown, baseUrl: string): ToolResult {
  if (!isServerError(error)) return fail(error);
  if (error.status > 0)
    return fail(
      `HTTP ${String(error.status)}: ${error.message} (${error.code})`,
    );
  if (error.code === 'network_error') {
    // ServerError -> CatalogClientError -> what fetch threw.
    const inner = (error.cause as { cause?: unknown } | undefined)?.cause;
    return connectionFail(inner ?? error, baseUrl, PLUGIN_ID);
  }
  return fail(error);
}

/**
 * Run a server call as a tool: a client on the configured URL (with the
 * plugin's key unless `withKey` is false), the result rewritten to the
 * public URL.
 *
 * @param context - Plugin API and public URL.
 * @param call - The call.
 * @param options - Whether to send the key.
 * @returns The tool result.
 */
export async function runServerCall(
  context: ToolContext,
  call: ServerCall,
  options: ServerCallOptions = {},
): Promise<ToolResult> {
  const baseUrl = getServiceUrl(context.api);
  const key =
    options.withKey === false ? undefined : getPluginInsiderKey(context.api);
  try {
    const client = createServerClient({
      baseUrl,
      ...(key === undefined ? {} : { auth: { key } }),
    });
    const data = await call(client, baseUrl);
    return ok(rewriteUrlsInData(data, baseUrl, context.publicUrl()));
  } catch (error) {
    return toolError(error, baseUrl);
  }
}

/**
 * Register tools as optional tools.
 *
 * @param api - Plugin API (registration target).
 * @param tools - The tools.
 */
export function registerTools(
  api: PluginApi,
  tools: readonly ToolDescriptor[],
): void {
  for (const tool of tools) api.registerTool(tool, { optional: true });
}
