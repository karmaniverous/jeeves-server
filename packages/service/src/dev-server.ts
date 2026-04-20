/**
 * Dev server launcher — initializes jeeves-core before starting the server.
 * Use this instead of server.ts directly when running `npm run dev`.
 */
import { init } from '@karmaniverous/jeeves';

init({
  workspacePath: process.env.JEEVES_WORKSPACE_PATH || 'J:\\jeeves',
  configRoot: process.env.JEEVES_CONFIG_ROOT || 'J:\\config',
});

await import('./server.js');
