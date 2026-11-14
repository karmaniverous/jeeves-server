/**
 * OAuth2 tools on the SDK (`oauthStart`, `oauthStatus`, `oauthToken`): `oauth_authorize`, `oauth_status`, `oauth_token`, with their 0.15.0 names, parameters and results.
 *
 * @packageDocumentation
 */

import type { ToolDescriptor } from '@karmaniverous/jeeves';

import { runServerCall, type ToolContext } from './sdkCall.js';

/** `provider` and `account` parameters. */
const CREDENTIAL_PROPERTIES = {
  provider: { type: 'string', description: 'OAuth provider name' },
  account: { type: 'string', description: 'Account identifier' },
};

/** Parameters of `oauth_status` and `oauth_token`. */
const CREDENTIAL_PARAMETERS = {
  type: 'object',
  properties: CREDENTIAL_PROPERTIES,
  required: ['provider', 'account'],
};

/** The provider and account of a call. */
const credentialOf = (params: Record<string, unknown>) => ({
  provider: String(params.provider),
  account: String(params.account),
});

/** Admin guidance added to a 400 (a provider the config doesn't list). */
const PROVIDER_GUIDANCE =
  '\n\nThe server admin should add this provider to the `oauth.providers` config to enable tool-based authorization.';

/** `oauth_authorize`. */
function authorizeTool(context: ToolContext): ToolDescriptor {
  return {
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
        clientId: { type: 'string', description: 'OAuth client ID' },
        clientSecret: { type: 'string', description: 'OAuth client secret' },
        scopes: {
          type: 'array',
          items: { type: 'string' },
          description: 'OAuth scopes to request (optional)',
        },
      },
      required: ['provider', 'account', 'clientId', 'clientSecret'],
    },
    execute: async (_id, params) => {
      const { provider, account } = credentialOf(params);
      const publicUrl = context.publicUrl();
      const result = await runServerCall(context, async (client) => {
        const { authUrl } = await client.oauthStart({
          provider,
          account,
          clientId: String(params.clientId),
          clientSecret: String(params.clientSecret),
          ...(Array.isArray(params.scopes)
            ? { scopes: params.scopes as string[] }
            : {}),
          ...(publicUrl ? { origin: publicUrl } : {}),
        });
        return `Please open this URL to authorize ${provider} for account ${account}:\n\n${authUrl}\n\nOnce you complete authorization in the browser, the credentials will be saved automatically.`;
      });
      const text = result.content[0]?.text ?? '';
      return result.isError && text.startsWith('Error: HTTP 400')
        ? {
            ...result,
            content: [{ type: 'text', text: text + PROVIDER_GUIDANCE }],
          }
        : result;
    },
  };
}

/**
 * Build the OAuth tools.
 *
 * @param context - Plugin API and public URL.
 * @returns `oauth_authorize`, `oauth_status` and `oauth_token`.
 */
export function createOAuthTools(context: ToolContext): ToolDescriptor[] {
  return [
    authorizeTool(context),
    {
      name: 'oauth_status',
      description:
        'Check if valid OAuth2 credentials exist for a provider/account. Returns whether credentials exist and whether they are expired.',
      parameters: CREDENTIAL_PARAMETERS,
      execute: (_id, params) =>
        runServerCall(context, (client) =>
          client.oauthStatus(credentialOf(params)),
        ),
    },
    {
      name: 'oauth_token',
      description:
        'Retrieve a valid access token for a provider/account. Automatically refreshes expired tokens when possible.',
      parameters: CREDENTIAL_PARAMETERS,
      execute: (_id, params) =>
        runServerCall(context, (client) =>
          client.oauthToken(credentialOf(params)),
        ),
    },
  ];
}
