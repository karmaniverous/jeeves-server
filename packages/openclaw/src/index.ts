/**
 * OpenClaw plugin entry point for jeeves-server.
 *
 * Registers server_* tools, initializes the jeeves-core library,
 * and starts a ComponentWriter to manage the Server section in TOOLS.md.
 */

import {
  type ComponentWriter,
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
 * Cached server menu content.
 *
 * @remarks
 * `generateServerMenu()` is async (HTTP fetch), but `JeevesComponent.generateToolsContent()`
 * is sync. We run an async background refresh that populates this cache, and the sync
 * generator returns whatever was last fetched.
 */
let cachedMenu =
  '> Initializing jeeves-server…\n> (First refresh may take up to ~1 minute.)';

/**
 * Background refresh handle for async menu fetching.
 */
let refreshHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Fetch the server menu asynchronously and cache it.
 *
 * @param apiUrl - The server API base URL.
 */
async function refreshMenuCache(apiUrl: string): Promise<void> {
  try {
    cachedMenu = await generateServerMenu(apiUrl);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[jeeves-server] Menu cache refresh failed: ${message}`);
  }
}

/**
 * Start the background menu cache refresh loop.
 *
 * @param apiUrl - The server API base URL.
 * @param intervalMs - Refresh interval in milliseconds.
 */
function startMenuCacheRefresh(apiUrl: string, intervalMs: number): void {
  // Immediate first fetch
  void refreshMenuCache(apiUrl);

  if (refreshHandle) clearInterval(refreshHandle);
  refreshHandle = setInterval(() => void refreshMenuCache(apiUrl), intervalMs);

  if (typeof refreshHandle === 'object' && 'unref' in refreshHandle) {
    refreshHandle.unref();
  }
}

/** Active writer instance (for cleanup if needed). */
let writer: ComponentWriter | null = null;

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

  // Start async menu cache refresh (slightly faster than writer cycle
  // so the cache is always fresh when generateToolsContent() is called)
  const refreshMs = (REFRESH_INTERVAL_SECONDS - 2) * 1000;
  startMenuCacheRefresh(baseUrl, refreshMs);

  // Create and start the component writer
  writer = createComponentWriter({
    name: 'server',
    version: PLUGIN_VERSION,
    sectionId: 'Server',
    refreshIntervalSeconds: REFRESH_INTERVAL_SECONDS,
    generateToolsContent: () => cachedMenu,
    serviceCommands: createServiceCommands(),
    pluginCommands: createPluginCommands(),
  });

  writer.start();
}
