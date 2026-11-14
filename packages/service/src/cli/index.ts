#!/usr/bin/env node
/**
 * jeeves-server CLI entrypoint.
 *
 * Uses `createServiceCli(descriptor)` from core for all standard commands,
 * with `status`, `config` and `config apply` re-wired through the SDK (see
 * `program.ts`). The `start` command uses `descriptor.startCommand` which
 * points to `start-server.ts` for direct in-process server launch.
 *
 * @packageDocumentation
 */

import { checkNodeVersion } from './checkNodeVersion.js';

checkNodeVersion();

import { createServerCli } from './program.js';

createServerCli().parse();
