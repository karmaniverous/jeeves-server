/**
 * Lazy platform `configRoot` resolution for the jeeves-server plugin.
 * Reads plugin config, then `JEEVES_CONFIG_ROOT`; warns once; defers core `init()`; guards tools.
 *
 * @remarks
 * With a running gateway, `openclaw plugins install` activates the plugin
 * before `jeeves install` writes `plugins.entries.<id>.config`, so
 * registration must succeed without a `configRoot`. Nothing here reads
 * config at registration time: the root is resolved each time a tool runs,
 * and core `init()` is called on first use (and again only if the root
 * changes).
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
export const CONFIG_ROOT_MISSING_MESSAGE = `configRoot not configured — set plugins.entries.${PLUGIN_ID}.config.configRoot in the plugin config or the ${CONFIG_ROOT_ENV_VAR} environment variable`;

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
    logWarning(
      api,
      `[${PLUGIN_ID}] ${CONFIG_ROOT_MISSING_MESSAGE}. Tools return an error until it is set.`,
    );
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
 * Wrap a tool so it returns {@link CONFIG_ROOT_MISSING_MESSAGE} instead of
 * running while `configRoot` is unset.
 */
export function guardTool(
  tool: ToolDescriptor,
  resolver: ConfigRootResolver,
): ToolDescriptor {
  return {
    ...tool,
    execute: (id, params) =>
      resolver.resolve()
        ? tool.execute(id, params)
        : Promise.resolve(fail(CONFIG_ROOT_MISSING_MESSAGE)),
  };
}

/**
 * Return a view of `api` whose `registerTool` guards every tool with
 * {@link guardTool}. All other members pass through unchanged.
 */
export function createGuardedApi(
  api: PluginApi,
  resolver: ConfigRootResolver,
): PluginApi {
  const registerTool = (
    tool: ToolDescriptor,
    options?: ToolRegistrationOptions,
  ): void => {
    api.registerTool(guardTool(tool, resolver), options);
  };
  return new Proxy(api, {
    get: (target, prop, receiver) =>
      prop === 'registerTool'
        ? registerTool
        : (Reflect.get(target, prop, receiver) as unknown),
  });
}
