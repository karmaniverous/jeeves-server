#!/usr/bin/env node
/**
 * jeeves-server CLI entrypoint.
 *
 * Uses `createServiceCli(descriptor)` from core for all standard commands.
 * The `start` command uses `descriptor.startCommand` which points to
 * `start-server.ts` for direct in-process server launch.
 *
 * @packageDocumentation
 */

const major = Number(process.versions.node.split('.')[0]);
if (major < 22) {
  console.error(
    'jeeves-server requires Node.js >= 22. Current: ' + process.version,
  );
  process.exit(1);
}

import { createServiceCli } from '@karmaniverous/jeeves';

import { serverDescriptor } from '../descriptor.js';

// Type assertion: core's bundled .d.ts doesn't fully resolve the Command
// return type for eslint, but the runtime value is a Commander instance.
const cli = createServiceCli(serverDescriptor) as {
  parse: (argv?: string[]) => void;
};

cli.parse();
