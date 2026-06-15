/**
 * Dev server launcher — initializes jeeves-core before starting the server.
 * Use this instead of server.ts directly when running `npm run dev`.
 */
import { init } from '@karmaniverous/jeeves';

import { initConfig } from './config/index.js';

init({
  workspacePath: process.env.JEEVES_WORKSPACE_PATH || 'J:\\jeeves',
  configRoot: process.env.JEEVES_CONFIG_ROOT || 'J:\\config',
});

// Pre-initialize config so server.ts finds it ready.
// In dev, default to the prod config path (port override keeps them separate).
const configPath =
  process.env.JEEVES_SERVER_CONFIG || 'J:\\config\\jeeves-server\\config.json';
const config = initConfig(configPath);

// Override port for dev to avoid colliding with the prod service.
const devPort = Number(process.env.JEEVES_SERVER_PORT) || 19340;
config.port = devPort;

await import('./server.js');
