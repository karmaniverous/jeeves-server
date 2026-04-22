/**
 * Server-specific HMAC authentication helpers for the OpenClaw plugin.
 *
 * @remarks
 * These helpers handle insider key derivation and URL signing for
 * authenticated requests to jeeves-server. Generic helpers (ok, fail,
 * connectionFail, fetchJson, etc.) are imported from `@karmaniverous/jeeves`.
 *
 * @packageDocumentation
 */

import {
  type PluginApi,
  resolveOptionalPluginSetting,
} from '@karmaniverous/jeeves';
import { computeInsiderKey } from '@karmaniverous/jeeves-server-shared';

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

/** Append auth key query param to a URL. */
export function withAuth(url: string, keySeed: string | undefined): string {
  if (!keySeed) return url;
  const derived = computeInsiderKey(keySeed);
  const sep = url.includes('?') ? '&' : '?';
  return url + sep + 'key=' + derived;
}
