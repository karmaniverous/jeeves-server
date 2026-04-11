/**
 * Domain-specific server tool registrations for the OpenClaw plugin.
 *
 * Standard tools (`server_status`, `server_config`, `server_config_apply`,
 * `server_service`) come from `createPluginToolset(descriptor)` in core.
 */

import {
  connectionFail,
  fetchJson,
  ok,
  type PluginApi,
  type ToolResult,
} from '@karmaniverous/jeeves';

import { PLUGIN_ID } from './constants.js';
import { getPluginKey, withAuth } from './helpers.js';

/** Milliseconds in one day. */
const MS_PER_DAY = 86_400_000;

/** Normalize a browse path param: strip leading slash. */
function normalizePath(params: Record<string, unknown>): string {
  return String(params.path).replace(/^\//, '');
}

/** Resolve a possibly-relative API URL against the configured base URL. */
function toAbsoluteUrl(baseUrl: string, url: string): string {
  return new URL(url, baseUrl).toString();
}

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
interface ApiToolConfig {
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
function registerApiTool(
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

/** Register all domain-specific server_* tools with the OpenClaw plugin API. */
export function registerServerTools(
  api: PluginApi,
  baseUrl: string,
  publicUrl?: string,
): void {
  const keySeed = getPluginKey(api);

  const tools: ApiToolConfig[] = [
    {
      name: 'server_link_info',
      description:
        'Query available link types for a path (exists, page URL, raw URL, export links for PDF/DOCX/SVG/PNG).',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Browse path (e.g. "j/domains/projects/readme.md")',
          },
        },
        required: ['path'],
      },
      buildRequest: (params) => {
        const p = normalizePath(params);
        return ['/api/link-info/' + p];
      },
    },
    {
      name: 'server_browse',
      description:
        'Get file or directory metadata. For files: size, mtime, content type, rendered HTML availability. For directories: listing of entries.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Browse path (e.g. "j/domains/projects")',
          },
        },
        required: ['path'],
      },
      buildRequest: (params) => {
        const p = normalizePath(params);
        return ['/api/path/' + p];
      },
    },
    {
      name: 'server_share',
      description:
        'Generate a share link for a path. Returns an HMAC-signed page URL and raw URL (when applicable), with optional expiry and directory depth.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Browse path to share',
          },
          expiryDays: {
            type: 'number',
            description: 'Link expiry in days (default: 30)',
          },
          depth: {
            type: 'number',
            description: 'Directory depth for deep shares (0 = file only)',
          },
          dirs: {
            type: 'boolean',
            description:
              'Include directory listings in deep share (default: false)',
          },
        },
        required: ['path'],
      },
      buildRequest: (params) => {
        const p = normalizePath(params);
        const body: Record<string, unknown> = { path: '/' + p };
        if (params.expiryDays !== undefined) {
          const ms = Date.now() + (params.expiryDays as number) * MS_PER_DAY;
          body.expiry = String(ms);
        }
        if (params.depth !== undefined) body.depth = params.depth;
        if (params.dirs !== undefined) body.dirs = params.dirs;
        return ['/api/share', 'POST', body];
      },
      transformResponse: (data, baseUrl) => {
        const result = data as {
          url?: string;
          path?: string;
          exp?: string | null;
          depth?: number;
          dirs?: boolean;
        };
        const pageUrl = result.url ? toAbsoluteUrl(baseUrl, result.url) : null;
        const rawUrl =
          pageUrl && !result.dirs && (result.depth ?? 0) === 0
            ? pageUrl.replace('/browse/', '/raw/')
            : null;

        return {
          ...result,
          url: pageUrl,
          pageUrl,
          rawUrl,
        };
      },
    },
    {
      name: 'server_export',
      description:
        'Trigger an export of a file or directory. Returns a download URL. Supported formats depend on file type and server capabilities (Chrome for PDF).',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Browse path to export',
          },
          format: {
            type: 'string',
            description: 'Export format: pdf, docx, svg, png, zip',
            enum: ['pdf', 'docx', 'svg', 'png', 'zip'],
          },
        },
        required: ['path', 'format'],
      },
      buildRequest: (params) => {
        const p = normalizePath(params);
        const fmt = String(params.format);
        return ['/api/export/' + p + '?format=' + fmt];
      },
    },
  ];

  for (const tool of tools) {
    registerApiTool(api, baseUrl, keySeed, publicUrl, tool);
  }

  api.registerTool(
    {
      name: 'server_event_status',
      description:
        'Query event gateway status: active schemas, recent event log entries, and event counts.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description:
              'Maximum number of recent events to return (default: 20)',
          },
        },
      },
      execute: async (
        _id: string,
        params: Record<string, unknown>,
      ): Promise<ToolResult> => {
        const limit = params.limit ? Number(params.limit) : 20;

        try {
          const [statusData, recentEvents] = await Promise.all([
            fetchJson(baseUrl + '/status'),
            fetchJson(
              withAuth(baseUrl + `/api/events?limit=${String(limit)}`, keySeed),
            ),
          ]);

          const health =
            (statusData as { health?: { events?: unknown[] } }).health ?? {};
          const activeSchemas = Array.isArray(health.events)
            ? health.events
            : [];
          const recent = Array.isArray(recentEvents) ? recentEvents : [];

          const result = {
            activeSchemas,
            schemaCount: activeSchemas.length,
            recentEvents: recent,
            recentCount: recent.length,
          };
          return ok(rewriteUrlsInData(result, baseUrl, publicUrl));
        } catch (error) {
          return connectionFail(error, baseUrl, PLUGIN_ID);
        }
      },
    },
    { optional: true },
  );
}
