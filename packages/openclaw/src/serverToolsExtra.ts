/**
 * Additional server tool registrations for the OpenClaw plugin.
 *
 * Covers: rotate-key, file-write, file-mutate, export-cache-clear, drives,
 * auth-status.
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
import type { FileMutationAction } from '@karmaniverous/jeeves-server-core';

import { PLUGIN_ID } from './constants.js';
import {
  type ApiToolConfig,
  encodePath,
  normalizePath,
  registerApiTool,
  rewriteUrlsInData,
} from './toolUtils.js';

/** Valid file mutation actions. */
const MUTATION_ACTIONS: FileMutationAction[] = [
  'edit-block',
  'delete-block',
  'insert-block',
  'edit-cell',
  'toggle-checkbox',
];

/** Register additional server_* tools with the OpenClaw plugin API. */
export function registerExtraServerTools(
  api: PluginApi,
  baseUrl: string,
  keySeed: string | undefined,
  publicUrl: string | undefined,
): void {
  const tools: ApiToolConfig[] = [
    {
      name: 'server_rotate_key',
      description:
        "Rotate the authenticated insider's API key. \u26a0\ufe0f WARNING: Rotating your key invalidates ALL existing share links you have created. This cannot be undone.",
      parameters: {
        type: 'object',
        properties: {},
      },
      buildRequest: () => ['/api/rotate-key', 'POST'],
    },
    {
      name: 'server_file_write',
      description:
        'Overwrite the content of an existing file. Insider-only; the file must already exist.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path (e.g. "<drive>/path/to/file.md")',
          },
          content: {
            type: 'string',
            description: 'New file content',
          },
        },
        required: ['path', 'content'],
      },
      buildRequest: (params) => {
        const p = normalizePath(params);
        return [
          '/api/file/' + encodePath(p),
          'PUT',
          { content: params.content },
        ];
      },
    },
    {
      name: 'server_file_mutate',
      description:
        'Apply a structured mutation to a .md file. Insider-only. Supports: edit-block, delete-block, insert-block, edit-cell, toggle-checkbox.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path (must be a .md file)',
          },
          action: {
            type: 'string',
            description: 'Mutation action to perform',
            enum: MUTATION_ACTIONS,
          },
          startLine: {
            type: 'number',
            description: 'Start line (1-based) for edit-block/delete-block',
          },
          endLine: {
            type: 'number',
            description: 'End line (1-based) for edit-block/delete-block',
          },
          content: {
            type: 'string',
            description: 'Content for edit-block, insert-block, or edit-cell',
          },
          atLine: {
            type: 'number',
            description: 'Target line (1-based) for insert-block',
          },
          position: {
            type: 'string',
            description: 'Insert position for insert-block',
            enum: ['before', 'after'],
          },
          context: {
            type: 'string',
            description: 'Optional context for insert-block (e.g. "table-row")',
          },
          line: {
            type: 'number',
            description: 'Line number (1-based) for edit-cell',
          },
          col: {
            type: 'number',
            description: 'Column index (0-based) for edit-cell',
          },
          index: {
            type: 'number',
            description: 'Checkbox index (0-based) for toggle-checkbox',
          },
          checked: {
            type: 'boolean',
            description: 'Desired checked state for toggle-checkbox',
          },
        },
        required: ['path', 'action'],
      },
      buildRequest: (params) => {
        const p = normalizePath(params);
        const body: Record<string, unknown> = { action: params.action };

        // Pass through action-specific params
        for (const key of [
          'startLine',
          'endLine',
          'content',
          'atLine',
          'position',
          'context',
          'line',
          'col',
          'index',
          'checked',
        ]) {
          if (params[key] !== undefined) body[key] = params[key];
        }

        return ['/api/file/' + encodePath(p), 'POST', body];
      },
    },
    {
      name: 'server_export_cache_clear',
      description: 'Clear the export and diagram caches for a given path.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Browse path to clear caches for',
          },
        },
        required: ['path'],
      },
      buildRequest: (params) => {
        const p = normalizePath(params);
        return ['/api/export-cache/' + encodePath(p), 'DELETE'];
      },
    },
    {
      name: 'server_drives',
      description:
        'List available root drives/labels configured on the server.',
      parameters: {
        type: 'object',
        properties: {},
      },
      buildRequest: () => ['/api/drives'],
    },
    {
      name: 'server_auth_status',
      description:
        'Check current authentication status. Returns whether authenticated, email, insider status, and key metadata.',
      parameters: {
        type: 'object',
        properties: {},
      },
      buildRequest: () => ['/api/auth/status'],
    },
    {
      name: 'server_resolve_path',
      description:
        'Convert an absolute filesystem path to a server browse path and optional public URL.',
      parameters: {
        type: 'object',
        properties: {
          fsPath: {
            type: 'string',
            description: 'Absolute filesystem path to resolve',
          },
        },
        required: ['fsPath'],
      },
      buildRequest: (params) => [
        '/api/resolve-path?fsPath=' + encodeURIComponent(String(params.fsPath)),
      ],
    },
  ];

  for (const tool of tools) {
    // server_auth_status and server_resolve_path do not require auth
    if (
      tool.name === 'server_auth_status' ||
      tool.name === 'server_resolve_path'
    ) {
      api.registerTool(
        {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
          execute: async (
            _id: string,
            params: Record<string, unknown>,
          ): Promise<ToolResult> => {
            try {
              const [endpoint] = tool.buildRequest(params);
              const rawData = await fetchJson(baseUrl + endpoint);
              const data = rewriteUrlsInData(rawData, baseUrl, publicUrl);
              return ok(data);
            } catch (error) {
              return connectionFail(error, baseUrl, PLUGIN_ID);
            }
          },
        },
        { optional: true },
      );
    } else {
      registerApiTool(api, baseUrl, keySeed, publicUrl, tool);
    }
  }
}
