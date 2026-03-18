/**
 * Shared types and utility functions for the OpenClaw plugin tool registrations.
 */

import { createHmac } from 'node:crypto';

import { PLUGIN_ID } from './constants.js';

/** Minimal OpenClaw plugin API surface used for tool registration. */
export interface PluginApi {
  config?: {
    plugins?: {
      entries?: Record<string, { config?: Record<string, unknown> }>;
    };
  };
  resolvePath?: (input: string) => string;
  registerTool(
    tool: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
      execute: (
        id: string,
        params: Record<string, unknown>,
      ) => Promise<ToolResult>;
    },
    options?: { optional?: boolean },
  ): void;
}

/** Result shape returned by each tool execution. */
export interface ToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

const DEFAULT_API_URL = 'http://127.0.0.1:1934';

/** Extract plugin config from the API object. */
export function getPluginConfig(
  api: PluginApi,
): Record<string, unknown> | undefined {
  return api.config?.plugins?.entries?.[PLUGIN_ID]?.config;
}

/** Resolve the server API base URL from plugin config. */
export function getApiUrl(api: PluginApi): string {
  const url = getPluginConfig(api)?.apiUrl;
  return typeof url === 'string' ? url : DEFAULT_API_URL;
}

/** Resolve the plugin key seed from plugin config. */
export function getPluginKey(api: PluginApi): string | undefined {
  const key = getPluginConfig(api)?.pluginKey;
  return typeof key === 'string' ? key : undefined;
}

/** Derive HMAC key from seed. */
export function deriveKey(seed: string): string {
  return createHmac('sha256', seed)
    .update('insider')
    .digest('hex')
    .substring(0, 32);
}

/** Append auth key query param to a URL. */
export function withAuth(url: string, keySeed: string | undefined): string {
  if (!keySeed) return url;
  const derived = deriveKey(keySeed);
  const sep = url.includes('?') ? '&' : '?';
  return url + sep + 'key=' + derived;
}

/** Format a successful tool result. */
export function ok(data: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

/** Format an error tool result. */
export function fail(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text', text: 'Error: ' + message }],
    isError: true,
  };
}

/** Format a connection error with actionable guidance. */
export function connectionFail(error: unknown, baseUrl: string): ToolResult {
  const cause = error instanceof Error ? error.cause : undefined;
  const code =
    cause && typeof cause === 'object' && 'code' in cause
      ? String((cause as { code?: unknown }).code)
      : '';
  const isConnectionError =
    code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT';

  if (isConnectionError) {
    return {
      content: [
        {
          type: 'text',
          text: [
            'Server not reachable at ' + baseUrl + '.',
            'Either start the jeeves-server service, or if it runs on a different port,',
            'set plugins.entries.jeeves-server-openclaw.config.apiUrl in openclaw.json.',
          ].join('\n'),
        },
      ],
      isError: true,
    };
  }

  return fail(error);
}

/** Fetch JSON from a URL, throwing on non-OK responses. */
export async function fetchJson(
  url: string,
  init?: RequestInit,
): Promise<unknown> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error('HTTP ' + String(res.status) + ': ' + (await res.text()));
  }
  return res.json();
}
