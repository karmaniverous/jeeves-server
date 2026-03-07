/**
 * OpenClaw plugin entry point. Registers all jeeves-server tools.
 */

import type { PluginApi } from './helpers.js';
import { getApiUrl } from './helpers.js';
import { registerServerTools } from './serverTools.js';
import { startToolsWriter } from './toolsWriter.js';

/** Register all jeeves-server tools with the OpenClaw plugin API. */
export default function register(api: PluginApi): void {
  const baseUrl = getApiUrl(api);
  registerServerTools(api, baseUrl);
  startToolsWriter(api);
}
