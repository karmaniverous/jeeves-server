/**
 * OpenClaw plugin entry point for jeeves-server.
 *
 * Registers server_* tools, initializes the jeeves-core library,
 * and starts a ComponentWriter to manage the Server section in TOOLS.md.
 */

import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
  type ComponentWriter,
  createAsyncContentCache,
  createComponentWriter,
  createPluginToolset,
  init,
  jeevesComponentDescriptorSchema,
  loadWorkspaceConfig,
  type PluginApi,
  resolveOptionalPluginSetting,
  resolvePluginSetting,
  resolveWorkspacePath,
  SERVER_PORT,
  WORKSPACE_CONFIG_DEFAULTS,
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

/** Resolve the optional public URL for shareable links. */
function getPublicUrl(api: PluginApi): string | undefined {
  return resolveOptionalPluginSetting(
    api,
    PLUGIN_ID,
    'publicUrl',
    'JEEVES_SERVER_PUBLIC_URL',
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

/** Resolve the globally installed service CLI entry point on Windows. */
function getGlobalServiceCliEntry(): string {
  const appData =
    process.env['APPDATA'] ?? join(homedir(), 'AppData', 'Roaming');
  return join(
    appData,
    'npm',
    'node_modules',
    '@karmaniverous',
    'jeeves-server',
    'dist',
    'src',
    'cli',
    'index.js',
  );
}

/** Build the command used by service managers to launch jeeves-server. */
function getServiceStartCommand(configPath: string): string[] {
  if (process.platform === 'win32') {
    return [
      process.execPath,
      getGlobalServiceCliEntry(),
      'start',
      '--config',
      configPath,
    ];
  }

  return ['jeeves-server', 'start', '--config', configPath];
}

/**
 * Build the plugin-side descriptor used by the ComponentWriter and standard
 * plugin toolset.
 */
function createPluginDescriptor(generateToolsContent: () => string) {
  return jeevesComponentDescriptorSchema.parse({
    name: 'server',
    version: PLUGIN_VERSION,
    servicePackage: '@karmaniverous/jeeves-server',
    pluginPackage: '@karmaniverous/jeeves-server-openclaw',
    defaultPort: SERVER_PORT,
    configSchema: z.looseObject({}),
    configFileName: 'config.json',
    initTemplate: () => ({}),
    run: () =>
      Promise.reject(
        new Error('Plugin-side descriptor does not support run()'),
      ),
    startCommand: getServiceStartCommand,
    sectionId: 'Server',
    refreshIntervalSeconds: REFRESH_INTERVAL_SECONDS,
    generateToolsContent,
    dependencies: { hard: [], soft: ['watcher', 'runner', 'meta'] },
  });
}

/** Register all jeeves-server tools and start the TOOLS.md writer. */
export default function register(api: PluginApi): void {
  // Stop any previous writer to prevent timer leaks on re-registration.
  if (activeWriter) {
    activeWriter.stop();
    activeWriter = null;
  }

  const baseUrl = getServiceUrl(api);

  // Initialize jeeves-core before creating descriptors/writers.
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

  const descriptor = createPluginDescriptor(getContent);

  for (const tool of createPluginToolset(descriptor)) {
    api.registerTool(tool, { optional: true });
  }

  const publicUrl = getPublicUrl(api);
  registerServerTools(api, baseUrl, publicUrl);

  // Resolve gatewayUrl for cleanup escalation
  const wsConfig = loadWorkspaceConfig(workspacePath);
  const gatewayUrl =
    wsConfig?.core?.gatewayUrl ?? WORKSPACE_CONFIG_DEFAULTS.core.gatewayUrl;

  activeWriter = createComponentWriter(descriptor, { gatewayUrl });
  activeWriter.start();
}
