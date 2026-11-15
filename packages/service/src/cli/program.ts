/**
 * The jeeves-server CLI program: jeeves' standard service CLI for the server descriptor, with `status`, `config` and `config apply` re-wired through the SDK. No I/O until parsed.
 *
 * @packageDocumentation
 */

import { createServiceCli } from '@karmaniverous/jeeves';

import { serverDescriptor } from '../descriptor.js';
import { type CliCommand, wireApiCommands } from './apiCommands.js';

/** The program, as far as the CLI and its tests use it. */
export interface ServerCli extends CliCommand {
  /** Parse `process.argv` and run the command. */
  parse(): void;
  /** Parse user arguments and run the command to completion. */
  parseAsync(argv: string[], options: { from: 'user' }): Promise<unknown>;
}

/**
 * Create the jeeves-server CLI program.
 *
 * @returns The program, ready to parse.
 */
export function createServerCli(): ServerCli {
  // core's bundled .d.ts doesn't fully resolve the Command type for eslint;
  // the runtime value is a Commander program.
  const program = createServiceCli(serverDescriptor) as unknown as ServerCli;
  wireApiCommands(program);
  return program;
}
