/**
 * Server tool registrations (server_* tools) for the OpenClaw plugin.
 */

import {
  connectionFail,
  fetchJson,
  getPluginKey,
  ok,
  type PluginApi,
  type ToolResult,
  withAuth,
} from './helpers.js';

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
          return connectionFail(error, baseUrl);
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
      buildRequest: () => ['/api/status'],
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
        const p = String(params.path).replace(/^\//, '');
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
        const p = String(params.path).replace(/^\//, '');
        return ['/api/directory/' + p];
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
        },
        required: ['path'],
      },
      buildRequest: (params) => {
        const p = String(params.path).replace(/^\//, '');
        const qs: string[] = [];
        if (params.expiryDays !== undefined)
          qs.push('exp=' + String(params.expiryDays as number));
        if (params.depth !== undefined)
          qs.push('d=' + String(params.depth as number));
        const query = qs.length > 0 ? '?' + qs.join('&') : '';
        return ['/api/share/' + p + query];
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
        const p = String(params.path).replace(/^\//, '');
        const fmt = String(params.format);
        return ['/export/' + p + '.' + fmt];
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
        return ['/api/status?events=' + limit];
      },
    },
  ];

  for (const tool of tools) {
    registerApiTool(api, baseUrl, keySeed, tool);
  }
}
