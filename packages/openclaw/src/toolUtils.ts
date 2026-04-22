/**
 * Shared utility functions for server tool registration.
 *
 * Extracted to avoid circular dependencies between serverTools and
 * serverToolsExtra.
 *
 * @packageDocumentation
 */

import {
  connectionFail,
  fetchJson,
  ok,
  type PluginApi,
  type ToolResult,
} from '@karmaniverous/jeeves';

import { PLUGIN_ID } from './constants.js';
import { withAuth } from './helpers.js';

/** Check that the character after a prefix match is a valid URL boundary. */
function isOriginBoundary(url: string, originLength: number): boolean {
  if (url.length <= originLength) return true;
  const next = url[originLength];
  return next === '/' || next === '?' || next === '#';
}

/**
 * Rewrite a single URL string: replace the baseUrl origin with publicUrl origin.
 * Only rewrites URLs that start with the baseUrl origin.
 */
export function rewriteUrl(
  url: string,
  baseUrl: string,
  publicUrl: string,
): string {
  const base = new URL(baseUrl);
  const pub = new URL(publicUrl);
  if (
    url.startsWith(base.origin) &&
    isOriginBoundary(url, base.origin.length)
  ) {
    return pub.origin + url.slice(base.origin.length);
  }
  return url;
}

/**
 * Deep-walk a JSON-serializable value and rewrite any string that starts
 * with the baseUrl origin to use the publicUrl origin instead.
 */
export function rewriteUrlsInData(
  data: unknown,
  baseUrl: string,
  publicUrl: string | undefined,
): unknown {
  if (!publicUrl) return data;

  const baseOrigin = new URL(baseUrl).origin;
  const pubOrigin = new URL(publicUrl).origin;

  function walk(value: unknown): unknown {
    if (typeof value === 'string') {
      if (
        value.startsWith(baseOrigin) &&
        isOriginBoundary(value, baseOrigin.length)
      ) {
        return pubOrigin + value.slice(baseOrigin.length);
      }
      return value;
    }
    if (Array.isArray(value)) {
      return value.map(walk);
    }
    if (value !== null && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        result[k] = walk(v);
      }
      return result;
    }
    return value;
  }

  return walk(data);
}

/** Config for a server API tool. */
export interface ApiToolConfig {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  /** Build the request: return [endpoint, method?, body?]. */
  buildRequest: (
    params: Record<string, unknown>,
  ) => [string, string?, unknown?];
  /** Optional response transformer. */
  transformResponse?: (
    data: unknown,
    baseUrl: string,
    params: Record<string, unknown>,
  ) => unknown;
}

/** Register a single API tool with standard try/catch + ok/connectionFail. */
export function registerApiTool(
  api: PluginApi,
  baseUrl: string,
  keySeed: string | undefined,
  publicUrl: string | undefined,
  config: ApiToolConfig,
): void {
  api.registerTool(
    {
      name: config.name,
      description: config.description,
      parameters: config.parameters,
      execute: async (
        _id: string,
        params: Record<string, unknown>,
      ): Promise<ToolResult> => {
        try {
          const [endpoint, method, body] = config.buildRequest(params);
          const url = withAuth(baseUrl + endpoint, keySeed);
          const init: RequestInit = {};
          if (method) init.method = method;
          if (body !== undefined) {
            init.method = method ?? 'POST';
            init.headers = { 'Content-Type': 'application/json' };
            init.body = JSON.stringify(body);
          }
          const rawData = await fetchJson(
            url,
            Object.keys(init).length > 0 ? init : undefined,
          );
          const transformed = config.transformResponse
            ? config.transformResponse(rawData, baseUrl, params)
            : rawData;
          const data = rewriteUrlsInData(transformed, baseUrl, publicUrl);
          return ok(data);
        } catch (error) {
          return connectionFail(error, baseUrl, PLUGIN_ID);
        }
      },
    },
    { optional: true },
  );
}

/** Encode path segments for use in a URL. */
export function encodePath(p: string): string {
  return p.split('/').map(encodeURIComponent).join('/');
}

/** Normalize a browse path param: strip leading slash. */
export function normalizePath(params: Record<string, unknown>): string {
  return String(params.path).replace(/^\//, '');
}

/** Resolve a possibly-relative API URL against the configured base URL. */
export function toAbsoluteUrl(baseUrl: string, url: string): string {
  return new URL(url, baseUrl).toString();
}
