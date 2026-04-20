/**
 * Dev server launcher — initializes jeeves-core before starting the server.
 * Use this instead of server.ts directly when running `npm run dev`.
 */
import { init } from '@karmaniverous/jeeves';

init({
  workspacePath: 'J:\\jeeves',
  configRoot: 'J:\\config',
});

await import('./server.js');
