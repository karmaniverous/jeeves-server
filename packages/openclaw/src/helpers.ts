/**
 * Plugin settings the tools read on every call: the server API URL and the plugin's key (derived from the `_plugin` seed in plugin config).
 *
 * @packageDocumentation
 */

import {
  type PluginApi,
  resolveOptionalPluginSetting,
  resolvePluginSetting,
  SERVER_PORT,
} from '@karmaniverous/jeeves';
import { computeInsiderKey } from '@karmaniverous/jeeves-server-core';

import { PLUGIN_ID } from './constants.js';

/** Resolve the plugin key seed from plugin config. */
export function getPluginKey(api: PluginApi): string | undefined {
  return resolveOptionalPluginSetting(
    api,
    PLUGIN_ID,
    'pluginKey',
    'JEEVES_SERVER_PLUGIN_KEY',
  );
}

/**
 * The key the plugin authenticates with: the insider key of its seed, or
 * `undefined` when no seed is configured (calls then go without a key).
 */
export function getPluginInsiderKey(api: PluginApi): string | undefined {
  const seed = getPluginKey(api);
  return seed ? computeInsiderKey(seed) : undefined;
}

/** Resolve the server API base URL from plugin config or environment. */
export function getServiceUrl(api: PluginApi): string {
  return resolvePluginSetting(
    api,
    PLUGIN_ID,
    'apiUrl',
    'JEEVES_SERVER_URL',
    `http://127.0.0.1:${String(SERVER_PORT)}`,
  );
}
