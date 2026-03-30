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

import { createServiceCli } from '@karmaniverous/jeeves';

import { serverDescriptor } from '../descriptor.js';

const cli = createServiceCli(serverDescriptor);

cli.parse();
