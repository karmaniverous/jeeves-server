/**
 * Server-side JeevesComponentDescriptor for the jeeves-server component.
 *
 * @packageDocumentation
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  jeevesComponentDescriptorSchema,
  SERVER_PORT,
} from '@karmaniverous/jeeves';

import { jeevesConfigSchema } from './config/schema.js';
import { packageVersion } from './util/packageVersion.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the start-server entry point (resolves correctly from any cwd). */
const startServerPath = path.resolve(__dirname, 'cli', 'start-server.js');

export const serverDescriptor = jeevesComponentDescriptorSchema.parse({
  name: 'server',
  version: packageVersion,
  servicePackage: '@karmaniverous/jeeves-server',
  pluginPackage: '@karmaniverous/jeeves-server-openclaw',
  defaultPort: SERVER_PORT,
  configSchema: jeevesConfigSchema,
  configFileName: 'config.json',
  initTemplate: () => ({
    chromePath: 'CHANGE_ME_chromePath',
    auth: {
      modes: ['keys'],
      sessionSecret: 'CHANGE_ME_sessionSecret',
    },
    keys: {
      default: 'CHANGE_ME_defaultKey',
    },
  }),
  onConfigApply: async () => {
    const { resetConfig } = await import('./config/index.js');
    resetConfig();
  },
  startCommand: (configPath: string) => [
    'node',
    startServerPath,
    '--config',
    configPath,
  ],
  sectionId: 'Server',
  refreshIntervalSeconds: 61,
  generateToolsContent: () => '',
  dependencies: { hard: [], soft: ['watcher', 'runner', 'meta'] },
});
