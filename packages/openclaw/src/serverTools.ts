/**
 * Server tool registrations (server_* tools) for the OpenClaw plugin.
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

/** Normalize a browse path param: strip leading slash. */
function normalizePath(params: Record<string, unknown>): string {
  return String(params.path).replace(/^\//, '');
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
}

/** Register a single API tool with standard try/catch + ok/connectionFail. */
function registerApiTool(
  api: PluginApi,
  baseUrl: string,
  keySeed: string | undefined,
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
          const data = await fetchJson(
            url,
            Object.keys(init).length > 0 ? init : undefined,
          );
          return ok(data);
        } catch (error) {
          return connectionFail(error, baseUrl, PLUGIN_ID);
        }
      },
    },
    { optional: true },
  );
}

/** Register all server_* tools with the OpenClaw plugin API. */
export function registerServerTools(api: PluginApi, baseUrl: string): void {
  const keySeed = getPluginKey(api);

  const tools: ApiToolConfig[] = [
    {
      name: 'server_status',
      description:
        'Get jeeves-server health: version, uptime, port, Chrome availability, export formats, connected services.',
      parameters: { type: 'object', properties: {} },
      buildRequest: () => ['/status'],
    },
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
        'Generate a share link for a path. Returns an HMAC-signed URL with optional expiry and directory depth.',
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
          const ms = Date.now() + (params.expiryDays as number) * 86400000;
          body.expiry = String(ms);
        }
        if (params.depth !== undefined) body.depth = params.depth;
        if (params.dirs !== undefined) body.dirs = params.dirs;
        return ['/api/share', 'POST', body];
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
      buildRequest: (params) => {
        const limit = params.limit ? String(params.limit as number) : '20';
        return ['/status?events=' + limit];
      },
    },
  ];

  for (const tool of tools) {
    registerApiTool(api, baseUrl, keySeed, tool);
  }
}
