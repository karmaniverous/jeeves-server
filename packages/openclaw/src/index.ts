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
  jeevesComponentDescriptorSchema,
  type PluginApi,
  resolvePluginSetting,
  resolveWorkspacePath,
  SERVER_PORT,
} from '@karmaniverous/jeeves';
import { z } from 'zod';

import { PLUGIN_ID } from './constants.js';
import { generateServerMenu } from './promptInjection.js';
import { registerServerTools } from './serverTools.js';

/** Plugin version derived from package.json at runtime. */
const require = createRequire(import.meta.url);
const { version: PLUGIN_VERSION } = require('../package.json') as {
  version: string;
};

/** Refresh interval in seconds (must be prime). */
const REFRESH_INTERVAL_SECONDS = 61;

/** Active writer instance — stopped on re-registration to prevent leaks. */
let activeWriter: ComponentWriter | null = null;

/** Resolve the server API base URL from plugin config or environment. */
function getServiceUrl(api: PluginApi): string {
  return resolvePluginSetting(
    api,
    PLUGIN_ID,
    'apiUrl',
    'JEEVES_SERVER_URL',
    'http://127.0.0.1:1934',
  );
}

/** Resolve the platform config root from plugin config or environment. */
function getConfigRoot(api: PluginApi): string {
  return resolvePluginSetting(
    api,
    PLUGIN_ID,
    'configRoot',
    'JEEVES_CONFIG_ROOT',
    'j:/config',
  );
}

/** Register all jeeves-server tools and start the TOOLS.md writer. */
export default function register(api: PluginApi): void {
  // Stop any previous writer to prevent timer leaks on re-registration.
  if (activeWriter) {
    activeWriter.stop();
    activeWriter = null;
  }

  const baseUrl = getServiceUrl(api);
  registerServerTools(api, baseUrl);

  // Initialize jeeves-core
  const workspacePath = resolveWorkspacePath(api);
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

  // Build a full component descriptor for the writer. Server-side-only fields
  // (configSchema, initTemplate, startCommand) use stubs because the plugin
  // doesn't validate config or manage the service — core handles that.
  const descriptor = jeevesComponentDescriptorSchema.parse({
    name: 'server',
    version: PLUGIN_VERSION,
    servicePackage: '@karmaniverous/jeeves-server',
    pluginPackage: '@karmaniverous/jeeves-server-openclaw',
    defaultPort: SERVER_PORT,
    configSchema: z.record(z.string(), z.unknown()),
    configFileName: 'config.json',
    initTemplate: () => ({}),
    startCommand: () => ['node', 'dist/src/cli/index.js', 'start'],
    sectionId: 'Server',
    refreshIntervalSeconds: REFRESH_INTERVAL_SECONDS,
    generateToolsContent: getContent,
    dependencies: { hard: [], soft: ['watcher', 'runner', 'meta'] },
  });

  // Create and start the component writer
  activeWriter = createComponentWriter(descriptor);

  activeWriter.start();
}
