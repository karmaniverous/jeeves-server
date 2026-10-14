/**
 * Public origin for absolute URLs the server hands out (magic links,
 * share-for links, OAuth redirect URIs) and for the cookie `secure` flag.
 *
 * The configured top-level `publicUrl` is the source of truth. Request
 * headers (`X-Forwarded-Proto`, `X-Forwarded-Host`, `Host`) are used only
 * when `trustProxyHeaders` is enabled: a client that reaches the server
 * directly can set them to anything.
 *
 * @packageDocumentation
 */

import type { RuntimeConfig } from '../config/types.js';

/** The request fields the origin can be derived from. */
export interface OriginRequest {
  headers: Record<string, string | string[] | undefined>;
  protocol?: string;
  hostname?: string;
}

/**
 * Error for a login request when no public origin can be determined. Config
 * validation already requires `publicUrl` (or `trustProxyHeaders: true`)
 * for email, Google and OAuth login, so this is a defensive guard only.
 */
export const PUBLIC_ORIGIN_CONFIG_ERROR =
  'Server misconfigured: set publicUrl (or trustProxyHeaders behind a proxy that sets X-Forwarded-* headers) to send login links and OAuth redirects.';

/** Host[:port], IPv4 or bracketed IPv6; nothing else is accepted. */
const HOST_RE =
  /^(?:[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*|\[[0-9A-Fa-f:.]+\])(?::\d{1,5})?$/u;

/** First comma-separated value of a (possibly repeated) header. */
function firstHeader(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const first = raw?.split(',')[0]?.trim();
  return first || undefined;
}

/**
 * Public base URL without a trailing slash (e.g. `https://docs.example.com`,
 * or `https://example.com/jeeves` when `publicUrl` has a path), or `null`
 * when it can't be determined safely.
 */
export function getPublicOrigin(
  config: Pick<RuntimeConfig, 'publicUrl' | 'trustProxyHeaders'>,
  request: OriginRequest,
): string | null {
  if (config.publicUrl) return config.publicUrl.replace(/\/+$/u, '');
  if (!config.trustProxyHeaders) return null;

  const proto = (
    firstHeader(request.headers['x-forwarded-proto']) ??
    request.protocol ??
    'http'
  ).toLowerCase();
  const host =
    firstHeader(request.headers['x-forwarded-host']) ??
    firstHeader(request.headers.host) ??
    request.hostname;
  if (proto !== 'http' && proto !== 'https') return null;
  if (!host || !HOST_RE.test(host)) return null;
  return `${proto}://${host}`;
}

/** Whether cookies should be `secure`: the public origin is https. */
export function isSecureOrigin(
  config: Pick<RuntimeConfig, 'publicUrl' | 'trustProxyHeaders'>,
  request: OriginRequest,
): boolean {
  return getPublicOrigin(config, request)?.startsWith('https://') ?? false;
}
