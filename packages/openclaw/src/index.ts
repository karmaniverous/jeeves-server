/**
 * OpenClaw plugin entry point for jeeves-server: registers the standard and server_* tools.
 * No config is read at registration; `configRoot` resolves lazily when a tool runs.
 *
 * @remarks
 * A standard OpenClaw plugin on the static-content jeeves core: no runtime
 * workspace-content writing, no timers, no plugin-specific installer.
 * `jeeves install` installs it and writes its plugin config.
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
  createPluginToolset,
  jeevesComponentDescriptorSchema,
  type PluginApi,
  resolvePluginSetting,
  SERVER_PORT,
} from '@karmaniverous/jeeves';
import { z } from 'zod';

import {
  type ConfigRootResolver,
  createConfigRootResolver,
  createGuardedApi,
} from './configRoot.js';
import { PLUGIN_ID } from './constants.js';
import { registerServerTools } from './serverTools.js';

/** Plugin version derived from package.json at runtime. */
const require = createRequire(import.meta.url);
const { version: PLUGIN_VERSION } = require('../package.json') as {
  version: string;
};

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

/**
 * Resolve the public URL from the server's own config.
 * Falls back to JEEVES_SERVER_PUBLIC_URL env var.
 * The server is the single source of truth for its own address.
 */
function getPublicUrl(configRoot: string): string | undefined {
  // Env var override
  const envUrl = process.env['JEEVES_SERVER_PUBLIC_URL'];
  if (envUrl) return envUrl;

  // Read from server config
  try {
    const configPath = join(configRoot, 'jeeves-server', 'config.json');
    const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<
      string,
      unknown
    >;
    return typeof raw['publicUrl'] === 'string' ? raw['publicUrl'] : undefined;
  } catch {
    return undefined;
  }
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

/** Build the plugin-side descriptor used by the standard plugin toolset. */
function createPluginDescriptor() {
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
  });
}

/** Resolve the public URL lazily: `undefined` while `configRoot` is unset. */
function createPublicUrlResolver(
  configRoot: ConfigRootResolver,
): () => string | undefined {
  return () => {
    const root = configRoot.resolve();
    return root ? getPublicUrl(root) : undefined;
  };
}

/**
 * Register all jeeves-server tools. Always succeeds, even with no plugin
 * config: a missing `configRoot` logs one warning. Only calls that read
 * `configRoot` (`server_service` `install`) return an error until it is
 * set; the HTTP API tools keep working.
 */
export default function register(api: PluginApi): void {
  const configRoot = createConfigRootResolver(api);
  configRoot.warnIfUnset();

  const guardedApi = createGuardedApi(api, configRoot);

  for (const tool of createPluginToolset(createPluginDescriptor())) {
    guardedApi.registerTool(tool, { optional: true });
  }

  registerServerTools(
    guardedApi,
    getServiceUrl(api),
    createPublicUrlResolver(configRoot),
  );
}
