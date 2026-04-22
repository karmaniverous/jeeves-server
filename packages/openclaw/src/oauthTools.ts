/**
 * OAuth2 tool registrations for the OpenClaw plugin.
 *
 * Three tools: oauth_authorize, oauth_status, oauth_token.
 */

import {
  connectionFail,
  fail,
  fetchJson,
  ok,
  type PluginApi,
  type ToolResult,
} from '@karmaniverous/jeeves';
import type { OAuthStartResponse } from '@karmaniverous/jeeves-server-core';

import { PLUGIN_ID } from './constants.js';
import { withAuth } from './helpers.js';

/** Register all OAuth tools with the plugin API. */
export function registerOAuthTools(
  api: PluginApi,
  baseUrl: string,
  keySeed: string | undefined,
  publicUrl: string | undefined,
): void {
  // oauth_authorize — Initiate OAuth2 authorization for a provider/account.
  api.registerTool(
    {
      name: 'oauth_authorize',
      description:
        'Initiate OAuth2 authorization for a provider/account. Returns an authorization URL for the user to open in their browser.',
      parameters: {
        type: 'object',
        properties: {
          provider: {
            type: 'string',
            description: 'OAuth provider name (must match server config)',
          },
          account: {
            type: 'string',
            description: 'Account identifier for credential storage',
          },
          clientId: {
            type: 'string',
            description: 'OAuth client ID',
          },
          clientSecret: {
            type: 'string',
            description: 'OAuth client secret',
          },
          scopes: {
            type: 'array',
            items: { type: 'string' },
            description: 'OAuth scopes to request (optional)',
          },
        },
        required: ['provider', 'account', 'clientId', 'clientSecret'],
      },
      execute: async (
        _id: string,
        params: Record<string, unknown>,
      ): Promise<ToolResult> => {
        const { provider, account, clientId, clientSecret, scopes } = params;

        const body: Record<string, unknown> = {
          provider,
          account,
          clientId,
          clientSecret,
        };
        if (scopes) body.scopes = scopes;
        if (publicUrl) body.origin = publicUrl;

        try {
          const url = withAuth(baseUrl + '/api/oauth/start', keySeed);
          const data = (await fetchJson(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })) as OAuthStartResponse;

          const authUrl = data.authUrl;
          if (!authUrl) {
            return fail('Server returned no authorization URL.');
          }

          return ok(
            `Please open this URL to authorize ${String(provider)} for account ${String(account)}:\n\n${authUrl}\n\nOnce you complete authorization in the browser, the credentials will be saved automatically.`,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);

          // Surface 400 errors for unconfigured providers with admin guidance.
          if (message.startsWith('HTTP 400')) {
            return fail(
              message +
                '\n\nThe server admin should add this provider to the `oauth.providers` config to enable tool-based authorization.',
            );
          }

          return connectionFail(error, baseUrl, PLUGIN_ID);
        }
      },
    },
    { optional: true },
  );

  // oauth_status — Check if valid OAuth2 credentials exist.
  api.registerTool(
    {
      name: 'oauth_status',
      description:
        'Check if valid OAuth2 credentials exist for a provider/account. Returns whether credentials exist and whether they are expired.',
      parameters: {
        type: 'object',
        properties: {
          provider: {
            type: 'string',
            description: 'OAuth provider name',
          },
          account: {
            type: 'string',
            description: 'Account identifier',
          },
        },
        required: ['provider', 'account'],
      },
      execute: async (
        _id: string,
        params: Record<string, unknown>,
      ): Promise<ToolResult> => {
        try {
          const url = withAuth(
            baseUrl +
              `/api/oauth/status?provider=${encodeURIComponent(String(params.provider))}&account=${encodeURIComponent(String(params.account))}`,
            keySeed,
          );
          const data = await fetchJson(url);
          return ok(data);
        } catch (error) {
          return connectionFail(error, baseUrl, PLUGIN_ID);
        }
      },
    },
    { optional: true },
  );

  // oauth_token — Retrieve a valid access token.
  api.registerTool(
    {
      name: 'oauth_token',
      description:
        'Retrieve a valid access token for a provider/account. Automatically refreshes expired tokens when possible.',
      parameters: {
        type: 'object',
        properties: {
          provider: {
            type: 'string',
            description: 'OAuth provider name',
          },
          account: {
            type: 'string',
            description: 'Account identifier',
          },
        },
        required: ['provider', 'account'],
      },
      execute: async (
        _id: string,
        params: Record<string, unknown>,
      ): Promise<ToolResult> => {
        try {
          const url = withAuth(
            baseUrl +
              `/api/oauth/token?provider=${encodeURIComponent(String(params.provider))}&account=${encodeURIComponent(String(params.account))}`,
            keySeed,
          );
          const data = await fetchJson(url);
          return ok(data);
        } catch (error) {
          return connectionFail(error, baseUrl, PLUGIN_ID);
        }
      },
    },
    { optional: true },
  );
}
