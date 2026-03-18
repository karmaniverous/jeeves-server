/**
 * OpenClaw plugin entry point for jeeves-server.
 *
 * Registers server_* tools, initializes the jeeves-core library,
 * and starts a ComponentWriter to manage the Server section in TOOLS.md.
 */

import { createRequire } from 'node:module';

import {
  type ComponentWriter,
  createAsyncContentCache,
  createComponentWriter,
  init,
} from '@karmaniverous/jeeves';

import { getApiUrl, getPluginConfig, type PluginApi } from './helpers.js';
import { generateServerMenu } from './promptInjection.js';
import { registerServerTools } from './serverTools.js';
import {
  createPluginCommands,
  createServiceCommands,
} from './serviceCommands.js';

/** Plugin version derived from package.json at runtime. */
const require = createRequire(import.meta.url);
const { version: PLUGIN_VERSION } = require('../package.json') as {
  version: string;
};

/** Default config root when not specified in plugin config. */
const DEFAULT_CONFIG_ROOT = 'j:/config';

/** Refresh interval in seconds (must be prime). */
const REFRESH_INTERVAL_SECONDS = 61;

/** Active writer instance — stopped on re-registration to prevent leaks. */
let activeWriter: ComponentWriter | null = null;

/**
 * Extract the configRoot from plugin config.
 */
function getConfigRoot(api: PluginApi): string {
  const root = getPluginConfig(api)?.configRoot;
  return typeof root === 'string' ? root : DEFAULT_CONFIG_ROOT;
}

/** Register all jeeves-server tools and start the TOOLS.md writer. */
export default function register(api: PluginApi): void {
  // Stop any previous writer to prevent timer leaks on re-registration.
  if (activeWriter) {
    activeWriter.stop();
    activeWriter = null;
  }

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
  activeWriter = createComponentWriter({
    name: 'server',
    version: PLUGIN_VERSION,
    sectionId: 'Server',
    refreshIntervalSeconds: REFRESH_INTERVAL_SECONDS,
    generateToolsContent: getContent,
    serviceCommands: createServiceCommands(),
    pluginCommands: createPluginCommands(),
  });

  activeWriter.start();
}
