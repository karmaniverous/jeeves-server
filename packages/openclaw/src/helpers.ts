/**
 * Server-specific HMAC authentication helpers for the OpenClaw plugin.
 *
 * @remarks
 * These helpers handle insider key derivation and URL signing for
 * authenticated requests to jeeves-server. Generic helpers (ok, fail,
 * connectionFail, fetchJson, etc.) are imported from `@karmaniverous/jeeves`.
 *
 * @module helpers
 */

import { createHmac } from 'node:crypto';

import type { PluginApi } from '@karmaniverous/jeeves';

import { PLUGIN_ID } from './constants.js';

/** Resolve the plugin key seed from plugin config. */
export function getPluginKey(api: PluginApi): string | undefined {
  const config = api.config?.plugins?.entries?.[PLUGIN_ID]?.config;
  const key = config?.pluginKey;
  return typeof key === 'string' ? key : undefined;
}

/** Derive HMAC key from seed. */
export function deriveKey(seed: string): string {
  return createHmac('sha256', seed)
    .update('insider')
    .digest('hex')
    .substring(0, 32);
}

/** Append auth key query param to a URL. */
export function withAuth(url: string, keySeed: string | undefined): string {
  if (!keySeed) return url;
  const derived = deriveKey(keySeed);
  const sep = url.includes('?') ? '&' : '?';
  return url + sep + 'key=' + derived;
}
