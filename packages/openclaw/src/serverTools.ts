/**
 * Domain-specific server tool registrations for the OpenClaw plugin.
 *
 * Standard tools (`server_status`, `server_config`, `server_config_apply`,
 * `server_service`) come from `createPluginToolset(descriptor)` in core.
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
import type { ShareResponse } from '@karmaniverous/jeeves-server-shared';

import { PLUGIN_ID } from './constants.js';
import { getPluginKey, withAuth } from './helpers.js';
import { registerOAuthTools } from './oauthTools.js';
import { registerExtraServerTools } from './serverToolsExtra.js';
import {
  type ApiToolConfig,
  normalizePath,
  registerApiTool,
  rewriteUrl,
  rewriteUrlsInData,
  toAbsoluteUrl,
} from './toolUtils.js';

// Re-export for tests and consumers that import from serverTools.
export { rewriteUrl, rewriteUrlsInData };

/** Milliseconds in one day. */
const MS_PER_DAY = 86_400_000;

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
        'Generate a share link for a path. Returns an HMAC-signed page URL and raw URL (when applicable), with optional expiry and directory depth. When insiders are specified, uses the share-for endpoint to target specific audience members.',
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
          insiders: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Email addresses of target audience insiders. When provided, uses the share-for endpoint.',
          },
          enforceOutsiderPolicy: {
            type: 'boolean',
            description:
              'Whether to enforce outsider policy when sharing (default: true)',
          },
        },
        required: ['path'],
      },
      buildRequest: (params) => {
        const p = normalizePath(params);

        if (Array.isArray(params.insiders) && params.insiders.length > 0) {
          const body: Record<string, unknown> = {
            path: '/' + p,
            insiders: params.insiders,
          };
          if (params.depth !== undefined) body.depth = params.depth;
          if (params.dirs !== undefined) body.dirs = params.dirs;
          if (params.enforceOutsiderPolicy !== undefined)
            body.enforceOutsiderPolicy = params.enforceOutsiderPolicy;
          return ['/api/util/share-for', 'POST', body];
        }

        const body: Record<string, unknown> = { path: '/' + p };
        if (params.expiryDays !== undefined) {
          const ms = Date.now() + (params.expiryDays as number) * MS_PER_DAY;
          body.expiry = String(ms);
        }
        if (params.depth !== undefined) body.depth = params.depth;
        if (params.dirs !== undefined) body.dirs = params.dirs;
        return ['/api/share', 'POST', body];
      },
      transformResponse: (data, baseUrl, params) => {
        // share-for responses already contain absolute URLs
        if (Array.isArray(params.insiders) && params.insiders.length > 0) {
          return data;
        }

        const result = data as ShareResponse;
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

  registerOAuthTools(api, baseUrl, keySeed, publicUrl);
  registerExtraServerTools(api, baseUrl, keySeed, publicUrl);
}
