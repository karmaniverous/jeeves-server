/**
 * Lazy platform `configRoot` resolution for the jeeves-server plugin.
 * Reads plugin config, then `JEEVES_CONFIG_ROOT`; warns once; defers core `init()`; gates only configRoot-reading tools.
 *
 * @remarks
 * With a running gateway, `openclaw plugins install` activates the plugin
 * before `jeeves install` writes `plugins.entries.<id>.config`, so
 * registration must succeed without a `configRoot`. Nothing here reads
 * config at registration time: the root is resolved each time a tool runs,
 * and core `init()` is called on first use (and again only if the root
 * changes).
 *
 * Only tools whose implementation reads `configRoot` are gated (see
 * {@link CONFIG_ROOT_GATES}). Tools that only call the service HTTP API keep
 * working without it.
 *
 * @packageDocumentation
 */

import {
  fail,
  init,
  type PluginApi,
  resolveOptionalPluginSetting,
  resolveWorkspacePath,
  type ToolDescriptor,
  type ToolRegistrationOptions,
} from '@karmaniverous/jeeves';

import { PLUGIN_ID } from './constants.js';

/** Environment variable consulted when plugin config has no `configRoot`. */
const CONFIG_ROOT_ENV_VAR = 'JEEVES_CONFIG_ROOT';

/** Error returned by tools (and logged once) while `configRoot` is unset. */
export const CONFIG_ROOT_MISSING_MESSAGE = `configRoot not configured — set it in plugin config (plugins.entries.${PLUGIN_ID}.config.configRoot) or via ${CONFIG_ROOT_ENV_VAR}`;

/**
 * One-time startup warning while `configRoot` is unset. Names only the call
 * {@link CONFIG_ROOT_GATES} refuses; every other tool keeps working.
 */
export const CONFIG_ROOT_UNSET_WARNING = `[${PLUGIN_ID}] configRoot not configured yet — server_service install will be unavailable until it is set in plugin config (plugins.entries.${PLUGIN_ID}.config.configRoot) or ${CONFIG_ROOT_ENV_VAR} (other tools are unaffected; links are not rewritten to publicUrl)`;

/** Decides, per call, whether a tool invocation reads `configRoot`. */
export type ConfigRootGate = (params: Record<string, unknown>) => boolean;

/**
 * Tools (and, where it matters, actions) whose implementation reads
 * `configRoot`. Every other tool only calls an HTTP API and is not gated.
 *
 * - `server_service` `install`: jeeves core resolves the service config path
 *   via `getComponentConfigDir()`, which needs core `init({ configRoot })`.
 *   Its other actions only drive the OS service manager by service name.
 */
export const CONFIG_ROOT_GATES: Readonly<Record<string, ConfigRootGate>> = {
  server_service: (params) => params['action'] === 'install',
};

/** Lazily resolves `configRoot` and initializes jeeves core on first use. */
export type ConfigRootResolver = {
  /** Resolve the root, initializing core when found; `undefined` when unset. */
  resolve: () => string | undefined;
  /** Log the missing-config warning (at most once) when the root is unset. */
  warnIfUnset: () => void;
};

/** Return a non-empty trimmed string, or `undefined`. */
function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Read `configRoot`: plugin-scoped config, OpenClaw config entry, then env. */
function readConfigRoot(api: PluginApi): string | undefined {
  return (
    nonEmpty(api.pluginConfig?.['configRoot']) ??
    nonEmpty(
      resolveOptionalPluginSetting(
        api,
        PLUGIN_ID,
        'configRoot',
        CONFIG_ROOT_ENV_VAR,
      ),
    )
  );
}

/** Log a warning through the host logger, falling back to the console. */
function logWarning(api: PluginApi, message: string): void {
  if (api.logger) api.logger.warn(message);
  else console.warn(message);
}

/**
 * Create a lazy `configRoot` resolver bound to a plugin API instance.
 *
 * @param api - Plugin API passed to `register()`.
 * @returns Resolver; never throws when the root is unset.
 */
export function createConfigRootResolver(api: PluginApi): ConfigRootResolver {
  let initializedRoot: string | undefined;
  let warned = false;

  const warnOnce = (): void => {
    if (warned) return;
    warned = true;
    logWarning(api, CONFIG_ROOT_UNSET_WARNING);
  };

  return {
    resolve: () => {
      const root = readConfigRoot(api);
      if (!root) {
        warnOnce();
        return undefined;
      }
      if (root !== initializedRoot) {
        init({ workspacePath: resolveWorkspacePath(api), configRoot: root });
        initializedRoot = root;
      }
      return root;
    },
    warnIfUnset: () => {
      if (!readConfigRoot(api)) warnOnce();
    },
  };
}

/**
 * Wrap a tool so that calls the gate marks as reading `configRoot` return
 * {@link CONFIG_ROOT_MISSING_MESSAGE} instead of running while it is unset.
 * Resolving the root also initializes jeeves core for those calls.
 */
export function guardTool(
  tool: ToolDescriptor,
  resolver: ConfigRootResolver,
  gate: ConfigRootGate = () => true,
): ToolDescriptor {
  return {
    ...tool,
    execute: (id, params) =>
      !gate(params) || resolver.resolve()
        ? tool.execute(id, params)
        : Promise.resolve(fail(CONFIG_ROOT_MISSING_MESSAGE)),
  };
}

/**
 * Return a view of `api` whose `registerTool` guards the tools listed in
 * `gates` with {@link guardTool} and registers every other tool unchanged.
 * All other members pass through unchanged.
 */
export function createGuardedApi(
  api: PluginApi,
  resolver: ConfigRootResolver,
  gates: Readonly<Record<string, ConfigRootGate>> = CONFIG_ROOT_GATES,
): PluginApi {
  const registerTool = (
    tool: ToolDescriptor,
    options?: ToolRegistrationOptions,
  ): void => {
    const gate = Object.hasOwn(gates, tool.name) ? gates[tool.name] : undefined;
    api.registerTool(gate ? guardTool(tool, resolver, gate) : tool, options);
  };
  return new Proxy(api, {
    get: (target, prop, receiver) =>
      prop === 'registerTool'
        ? registerTool
        : (Reflect.get(target, prop, receiver) as unknown),
  });
}
