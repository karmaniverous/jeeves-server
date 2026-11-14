/**
 * Re-wires the `status`, `config` and `config apply` commands of jeeves' `createServiceCli` through the SDK, so `config` and `config apply` can reach the admin-only config routes. Reads patches from a file or stdin; network I/O via the SDK.
 *
 * @remarks
 * Core registers the three commands with an HTTP helper that sends no
 * credentials. This module keeps their names, arguments, options and output
 * (pretty JSON on stdout), adds `--key <key>` and `-c, --config <path>` to
 * `config` and `config apply` (key resolution in `cliKey.ts`), and replaces
 * only the action handlers. `status` is public, so it sends no key. Every
 * command addresses `http://127.0.0.1:<port>`. Failures print core's prefix,
 * then `<code>: <message>`, plus a key hint on 401/403, and set exit code 1.
 */

import { readFileSync } from 'node:fs';

import {
  createServerClient,
  isServerError,
  type ServerClient,
} from '@karmaniverous/jeeves-server-sdk';

import {
  type CliKeyOptions,
  KEY_ENV_VAR,
  keyHint,
  resolveCliKey,
} from './cliKey.js';

/** What this module needs of a Commander command. */
export interface CliCommand {
  /** The command's name. */
  name(): string;
  /** Its subcommands. */
  readonly commands: readonly CliCommand[];
  /** Add an option. */
  option(flags: string, description: string): unknown;
  /** Replace the action handler (called with the declared arguments first). */
  action(fn: (...args: unknown[]) => Promise<void>): unknown;
  /** Its parsed options. */
  opts(): Record<string, unknown>;
}

/** Parsed options of the re-wired commands. */
interface ApiOptions extends CliKeyOptions {
  port: string;
  file?: string;
  replace?: boolean;
}

/**
 * Read a command's parsed options.
 *
 * @param cmd - The command.
 * @returns Its options, typed.
 */
function optionsOf(cmd: CliCommand): ApiOptions {
  const { port, key, config, file, replace } = cmd.opts();
  const text = (value: unknown) =>
    typeof value === 'string' ? value : undefined;
  return {
    port: String(port),
    ...(text(key) === undefined ? {} : { key: text(key) }),
    ...(text(config) === undefined ? {} : { config: text(config) }),
    ...(text(file) === undefined ? {} : { file: text(file) }),
    ...(replace === true ? { replace: true } : {}),
  };
}

/**
 * Describe a failure: `<code>: <message>`, plus the key hint on 401/403.
 *
 * @param error - What the command threw.
 * @param keySent - Whether the request carried a key.
 * @returns The text to print.
 */
export function describeFailure(error: unknown, keySent: boolean): string {
  if (!isServerError(error))
    return error instanceof Error ? error.message : String(error);
  const line = `${error.code}: ${error.message}`;
  return error.status === 401 || error.status === 403
    ? `${line}\n${keyHint(keySent)}`
    : line;
}

/**
 * Run a command body against the SDK, printing its result as JSON or its
 * failure with `prefix`.
 *
 * @param prefix - Core's failure prefix for the command.
 * @param opts - The command's options.
 * @param withKey - Whether the command sends a key.
 * @param body - Calls the client.
 */
async function run(
  prefix: string,
  opts: ApiOptions,
  withKey: boolean,
  body: (client: ServerClient) => Promise<unknown>,
): Promise<void> {
  let key: string | undefined;
  try {
    key = withKey ? resolveCliKey(opts) : undefined;
    const client = createServerClient({
      baseUrl: `http://127.0.0.1:${opts.port}`,
      ...(key === undefined ? {} : { auth: { key } }),
    });
    console.log(JSON.stringify(await body(client), null, 2));
  } catch (error) {
    console.error(`${prefix}: ${describeFailure(error, key !== undefined)}`);
    process.exitCode = 1;
  }
}

/**
 * Read a config patch from `file`, else from stdin (empty input = `{}`).
 *
 * @param file - Patch file, if given.
 * @returns The patch.
 * @throws With a one-line message when the input isn't a JSON object.
 */
export async function readPatch(
  file?: string,
): Promise<Record<string, unknown>> {
  let input: string;
  if (file === undefined) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    input = Buffer.concat(chunks).toString('utf8');
  } else input = readFileSync(file, 'utf8');
  if (input.trim() === '') return {};
  const patch = JSON.parse(input) as unknown;
  if (typeof patch !== 'object' || patch === null || Array.isArray(patch))
    throw new Error('patch must be a JSON object');
  return patch as Record<string, unknown>;
}

/**
 * The direct subcommand of a command with a name.
 *
 * @param parent - The command.
 * @param name - The subcommand's name.
 * @returns It, if registered.
 */
const commandNamed = (parent: CliCommand, name: string) =>
  parent.commands.find((cmd) => cmd.name() === name);

/**
 * Add the key options to a command.
 *
 * @param cmd - The command.
 */
function addKeyOptions(cmd: CliCommand): void {
  cmd.option(
    '--key <key>',
    `Insider or machine key (default: the ${KEY_ENV_VAR} environment variable)`,
  );
  cmd.option(
    '-c, --config <path>',
    'Server config file: send the insider key of its keys._plugin',
  );
}

/**
 * Re-wire core's `status`, `config` and `config apply` through the SDK.
 * Commands that aren't registered are skipped.
 *
 * @param program - The service CLI, after core registered its commands.
 */
export function wireApiCommands(program: CliCommand): void {
  const status = commandNamed(program, 'status');
  status?.action(() =>
    run('Service unreachable', optionsOf(status), false, (client) =>
      client.status(),
    ),
  );

  const config = commandNamed(program, 'config');
  if (!config) return;
  addKeyOptions(config);
  config.action((jsonpath) =>
    run('Config query failed', optionsOf(config), true, (client) =>
      client.config(typeof jsonpath === 'string' ? { path: jsonpath } : {}),
    ),
  );

  const apply = commandNamed(config, 'apply');
  if (!apply) return;
  addKeyOptions(apply);
  apply.action(() => {
    const opts = optionsOf(apply);
    return run('Config apply failed', opts, true, async (client) =>
      client.configApply({
        patch: await readPatch(opts.file),
        ...(opts.replace ? { replace: true } : {}),
      }),
    );
  });
}
