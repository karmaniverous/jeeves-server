/**
 * Test helpers: the plugin registered against a stub API, with global `fetch` answered by route (`METHOD /path`) and every request recorded.
 *
 * @packageDocumentation
 */

import type {
  PluginApi,
  ToolDescriptor,
  ToolResult,
} from '@karmaniverous/jeeves';
import { computeInsiderKey } from '@karmaniverous/jeeves-server-core';
import { vi } from 'vitest';

import { PLUGIN_ID } from '../constants.js';
import register from '../index.js';

/** The server URL the plugin is configured with. */
export const BASE_URL = 'http://127.0.0.1:1934';

/** The plugin's seed, and the key it derives. */
export const PLUGIN_SEED = 'plugin-seed';
export const PLUGIN_KEY = computeInsiderKey(PLUGIN_SEED);

/** A recorded request. */
export interface RecordedRequest {
  method: string;
  url: URL;
  body: unknown;
}

/** A reply: JSON body and status (default 200). */
export interface Reply {
  status?: number;
  body: unknown;
}

/** Replies by `METHOD /path`. */
export type Routes = Record<string, Reply | ((req: RecordedRequest) => Reply)>;

/**
 * Stub global `fetch` with `routes`; unknown routes get 404.
 *
 * @param routes - Replies by route.
 * @returns The recorded requests.
 */
export function fakeServer(routes: Routes): RecordedRequest[] {
  const requests: RecordedRequest[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init: RequestInit = {}) => {
      const url = new URL(input);
      const req: RecordedRequest = {
        method: init.method ?? 'GET',
        url,
        body:
          typeof init.body === 'string'
            ? (JSON.parse(init.body) as unknown)
            : undefined,
      };
      requests.push(req);
      const route = routes[`${req.method} ${url.pathname}`] as
        Routes[string] | undefined;
      const reply =
        typeof route === 'function'
          ? route(req)
          : (route ?? {
              status: 404,
              body: {
                statusCode: 404,
                code: 'SERVER_NOT_FOUND',
                error: 'Not Found',
                message: 'Not found',
              },
            });
      return Promise.resolve(
        new Response(JSON.stringify(reply.body), {
          status: reply.status ?? 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }),
  );
  return requests;
}

/**
 * Register the plugin (key seed and URL configured) and return its tools.
 *
 * @param config - Extra plugin config.
 * @returns The tools by name.
 */
export function pluginTools(
  config: Record<string, unknown> = {},
): Map<string, ToolDescriptor> {
  const tools = new Map<string, ToolDescriptor>();
  const api: PluginApi = {
    registerTool: (tool: ToolDescriptor) => {
      tools.set(tool.name, tool);
    },
    logger: { warn: vi.fn() },
    config: {
      plugins: {
        entries: {
          [PLUGIN_ID]: {
            config: { apiUrl: BASE_URL, pluginKey: PLUGIN_SEED, ...config },
          },
        },
      },
    },
  };
  register(api);
  return tools;
}

/**
 * Run a tool.
 *
 * @param tools - The tools.
 * @param name - Tool name.
 * @param params - Parameters.
 * @returns The result.
 */
export function runTool(
  tools: Map<string, ToolDescriptor>,
  name: string,
  params: Record<string, unknown> = {},
): Promise<ToolResult> {
  const tool = tools.get(name);
  if (!tool) throw new Error(`tool not registered: ${name}`);
  return tool.execute('call-1', params);
}

/** The text of a result. */
export const textOf = (result: ToolResult): string =>
  result.content[0]?.text ?? '';

/** The JSON of a successful result. */
export const jsonOf = (result: ToolResult): unknown =>
  JSON.parse(textOf(result)) as unknown;
