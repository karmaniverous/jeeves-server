/**
 * The key the CLI's API commands send, and the hint printed when the server refuses it. Key resolution: `--key`, then the `JEEVES_SERVER_KEY` environment variable, then the insider key derived from `keys._plugin` in the config file given by `-c, --config`. Reads that file; otherwise pure.
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs';

import { computeInsiderKey } from '@karmaniverous/jeeves-server-core';

/** Environment variable holding the CLI's key. */
export const KEY_ENV_VAR = 'JEEVES_SERVER_KEY';

/** Where the CLI reads its key from (named in the 401/403 hint). */
const KEY_SOURCES = `--key <key>, the ${KEY_ENV_VAR} environment variable, or keys._plugin in the config file given by -c, --config`;

/** Key sources of one invocation. */
export interface CliKeyOptions {
  /** `--key` value. */
  key?: string;
  /** `-c, --config` value: a server config file. */
  config?: string;
}

/**
 * A value, treating blank as unset.
 *
 * @param value - The value.
 * @returns It, or `undefined` when missing or blank.
 */
const nonBlank = (value: string | undefined): string | undefined =>
  value !== undefined && value.trim() !== '' ? value : undefined;

/**
 * The seed of `keys._plugin` in a server config file.
 *
 * @param file - The config file.
 * @returns The seed, or `undefined` when the file has no `_plugin` key.
 * @throws With a one-line message when the file can't be read or isn't JSON.
 */
function pluginSeedIn(file: string): string | undefined {
  let config: unknown;
  try {
    config = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(
      `cannot read keys._plugin from ${file} (${error instanceof Error ? error.message : String(error)})`,
      { cause: error },
    );
  }
  const entry = (config as { keys?: Record<string, unknown> } | null)?.keys
    ?._plugin;
  if (typeof entry === 'string') return nonBlank(entry);
  const seed = (entry as { key?: unknown } | undefined)?.key;
  return typeof seed === 'string' ? nonBlank(seed) : undefined;
}

/**
 * Resolve the key of a CLI invocation.
 *
 * @param options - `--key` and `-c, --config`.
 * @param env - Environment to read {@link KEY_ENV_VAR} from.
 * @returns The first of `--key`, the env var and the insider key derived
 *   from the config file's `keys._plugin`, or `undefined`.
 * @throws With a one-line message when `--config` is consulted and can't be read.
 */
export function resolveCliKey(
  options: CliKeyOptions,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const explicit = nonBlank(options.key) ?? nonBlank(env[KEY_ENV_VAR]);
  if (explicit !== undefined || options.config === undefined) return explicit;
  const seed = pluginSeedIn(options.config);
  return seed === undefined ? undefined : computeInsiderKey(seed);
}

/**
 * The hint printed after a 401 or 403. Never contains the key.
 *
 * @param keySent - Whether the request carried a key.
 * @returns Guidance on supplying (or checking) the key.
 */
export function keyHint(keySent: boolean): string {
  return keySent
    ? `The server refused the key; config needs an unscoped (admin) key. Check ${KEY_SOURCES}.`
    : `The server requires an admin key. Provide it via ${KEY_SOURCES}.`;
}
