/**
 * CLI for installing/uninstalling the jeeves-server OpenClaw plugin.
 *
 * Usage:
 *   `npx @karmaniverous/jeeves-server-openclaw install`
 *   `npx @karmaniverous/jeeves-server-openclaw uninstall`
 *
 * @packageDocumentation
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPluginCli } from '@karmaniverous/jeeves';

import { PLUGIN_ID } from './constants.js';

const distDir = resolve(dirname(fileURLToPath(import.meta.url)));

// Type assertion: core's bundled .d.ts doesn't fully resolve the Command
// return type for eslint, but the runtime value is a Commander instance.
const program = createPluginCli({
  pluginId: PLUGIN_ID,
  distDir,
  pluginPackage: '@karmaniverous/jeeves-server-openclaw',
  componentName: 'server',
}) as { parse: (argv?: string[]) => void };

program.parse();
