/**
 * The OpenClaw plugin (`packages/openclaw`) against the real app: the plugin registered as `jeeves install` configures it (the API URL and an optional machine key seed), with its requests to the API URL answered by the wire app through an `inject`-backed `fetch`.
 *
 * @packageDocumentation
 */

import type {
  PluginApi,
  ToolDescriptor,
  ToolResult,
} from '@karmaniverous/jeeves';
import { vi } from 'vitest';

import register from '../../../../openclaw/src/index.js';
import { injectFetch, SDK_BASE_URL } from '../sdk/sdkHarness.js';
import type { WireApp } from '../wire/wireApp.js';

/** The plugin's id in OpenClaw config. */
const PLUGIN_ID = 'jeeves-server-openclaw';

/**
 * Register the plugin and return its tools.
 *
 * @param pluginKey - The key seed in plugin config (none when omitted).
 * @returns The tools by name.
 */
export function pluginTools(pluginKey?: string): Map<string, ToolDescriptor> {
  const tools = new Map<string, ToolDescriptor>();
  const config = { apiUrl: SDK_BASE_URL, ...(pluginKey ? { pluginKey } : {}) };
  const api: PluginApi = {
    registerTool: (tool: ToolDescriptor) => {
      tools.set(tool.name, tool);
    },
    logger: { warn: vi.fn() },
    config: { plugins: { entries: { [PLUGIN_ID]: { config } } } },
  };
  register(api);
  return tools;
}

/**
 * Send the plugin's requests (to its API URL) to the wire app; anything else
 * to the wire app's guarded `fetch`.
 *
 * @param wire - The wire app.
 */
export function routePluginFetch(wire: WireApp): void {
  const guarded = globalThis.fetch;
  const app = injectFetch(wire.app);
  vi.stubGlobal('fetch', (input: string, init: RequestInit = {}) =>
    input.startsWith(SDK_BASE_URL) ? app(input, init) : guarded(input, init),
  );
}

/**
 * Status of a GET of `url` on the wire app.
 *
 * @param wire - The wire app.
 * @param url - Absolute URL.
 * @param session - Whether to send the admin's session cookie.
 * @returns The status.
 */
export async function statusOf(
  wire: WireApp,
  url: string,
  session = false,
): Promise<number> {
  const res = await injectFetch(wire.app)(url, {
    ...(session ? { credentials: 'same-origin' } : {}),
  });
  return res.status;
}

/**
 * Run a tool.
 *
 * @param tools - The plugin's tools.
 * @param name - Tool name.
 * @param params - Tool parameters.
 * @returns The tool result.
 */
export async function runTool(
  tools: Map<string, ToolDescriptor>,
  name: string,
  params: Record<string, unknown> = {},
): Promise<ToolResult> {
  const tool = tools.get(name);
  if (!tool) throw new Error(`tool not registered: ${name}`);
  return tool.execute('call-1', params);
}

/**
 * The JSON of a successful result.
 *
 * @param result - A tool result.
 * @returns Its JSON.
 * @throws The result text when the result is an error.
 */
export function jsonOf(result: ToolResult): Record<string, unknown> {
  if (result.isError) throw new Error(result.content[0]?.text);
  return JSON.parse(result.content[0]?.text ?? '') as Record<string, unknown>;
}
