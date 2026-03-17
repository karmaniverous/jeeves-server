/**
 * OpenClaw plugin entry point for jeeves-server.
 *
 * Registers server_* tools, initializes the jeeves-core library,
 * and starts a ComponentWriter to manage the Server section in TOOLS.md.
 */

import {
  createAsyncContentCache,
  createComponentWriter,
  init,
} from '@karmaniverous/jeeves';

import { getApiUrl, type PluginApi } from './helpers.js';
import { generateServerMenu } from './promptInjection.js';
import { registerServerTools } from './serverTools.js';
import {
  createPluginCommands,
  createServiceCommands,
} from './serviceCommands.js';

/** Plugin version — kept in sync with package.json via release-it hook. */
const PLUGIN_VERSION = '0.3.0';

/** Default config root when not specified in plugin config. */
const DEFAULT_CONFIG_ROOT = 'j:/config';

/** Refresh interval in seconds (must be prime). */
const REFRESH_INTERVAL_SECONDS = 61;

/**
 * Extract the configRoot from plugin config.
 */
function getConfigRoot(api: PluginApi): string {
  const config =
    api.config?.plugins?.entries?.['jeeves-server-openclaw']?.config;
  const root = config?.configRoot;
  return typeof root === 'string' ? root : DEFAULT_CONFIG_ROOT;
}

/** Register all jeeves-server tools and start the TOOLS.md writer. */
export default function register(api: PluginApi): void {
  const baseUrl = getApiUrl(api);
  registerServerTools(api, baseUrl);

  // Initialize jeeves-core
  const workspacePath = api.resolvePath ? api.resolvePath('.') : process.cwd();
  const configRoot = getConfigRoot(api);

  init({ workspacePath, configRoot });

  // Create async content cache: fetches server status on each writer cycle,
  // returns cached content synchronously for generateToolsContent().
  const getContent = createAsyncContentCache({
    fetch: async () => generateServerMenu(baseUrl),
    placeholder: '> Initializing jeeves-server…',
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[jeeves-server] Menu cache refresh failed: ${message}`);
    },
  });

  // Create and start the component writer
  const writer = createComponentWriter({
    name: 'server',
    version: PLUGIN_VERSION,
    sectionId: 'Server',
    refreshIntervalSeconds: REFRESH_INTERVAL_SECONDS,
    generateToolsContent: getContent,
    serviceCommands: createServiceCommands(),
    pluginCommands: createPluginCommands(),
  });

  writer.start();
}
