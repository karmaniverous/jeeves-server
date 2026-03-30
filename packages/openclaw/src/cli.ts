/**
 * CLI for installing/uninstalling the jeeves-server OpenClaw plugin.
 *
 * Delegates to the standard `createPluginCli` factory from jeeves-core,
 * which handles extension copy, config patching, heartbeat management,
 * and managed-section cleanup.
 *
 * @packageDocumentation
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPluginCli } from '@karmaniverous/jeeves';

import { PLUGIN_ID } from './constants.js';

const program = createPluginCli({
  pluginId: PLUGIN_ID,
  distDir: resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist'),
  pluginPackage: '@karmaniverous/jeeves-server-openclaw',
  componentName: 'server',
});

program.parse();
