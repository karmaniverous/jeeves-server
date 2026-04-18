/**
 * OAuth2 callback route (unauthenticated, top-level).
 *
 * GET /oauth/callback — Browser redirect target from OAuth providers.
 */

import fsp from 'node:fs/promises';

import type { FastifyPluginAsync } from 'fastify';

import { getConfig } from '../config/index.js';
import { consumePending, credentialPath } from '../services/oauthState.js';

function renderPage(title: string, heading: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:system-ui,sans-serif;max-width:600px;margin:60px auto;padding:0 20px;">
<h1>${heading}</h1>
<p>${message}</p>
</body>
</html>`;
}

export const oauthRoute: FastifyPluginAsync = (fastify) => {
  fastify.get<{
    Querystring: {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };
  }>('/oauth/callback', async (request, reply) => {
    const config = getConfig();
    const serverName = 'Jeeves Server';

    if (!config.oauth) {
      void reply.type('text/html').code(501);
      return renderPage(
        `${serverName} — OAuth Error`,
        'OAuth Error',
        'OAuth not configured.',
      );
    }

    // Error from provider
    if (request.query.error) {
      const desc = request.query.error_description ?? request.query.error;
      void reply.type('text/html').code(400);
      return renderPage(
        `${serverName} — Authorization Error`,
        'Authorization Error',
        desc,
      );
    }

    const { code, state } = request.query;

    if (!state || !code) {
      void reply.type('text/html').code(400);
      return renderPage(
        `${serverName} — Authorization Error`,
        'Authorization Error',
        'Missing code or state parameter.',
      );
    }

    // Look up and consume pending auth
    const pending = consumePending(state);
    if (!pending) {
      void reply.type('text/html').code(400);
      return renderPage(
        `${serverName} — Authorization Error`,
        'Authorization Error',
        'Authorization session expired or invalid.',
      );
    }

    // Exchange code for tokens
    try {
      const params = new URLSearchParams();
      params.set('grant_type', 'authorization_code');
      params.set('code', code);
      params.set('redirect_uri', pending.redirectUri);
      params.set('client_id', pending.clientId);
      params.set('client_secret', pending.clientSecret);
      if (pending.codeVerifier) {
        params.set('code_verifier', pending.codeVerifier);
      }

      const response = await fetch(pending.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        void reply.type('text/html').code(502);
        return renderPage(
          `${serverName} — Token Exchange Error`,
          'Token Exchange Error',
          `Failed to exchange authorization code: ${errorText}`,
        );
      }

      const tokenData = (await response.json()) as Record<string, unknown>;

      // Build credential file
      const credential: Record<string, unknown> = {
        provider: pending.provider,
        account: pending.account,
        access_token: tokenData.access_token,
        token_type: tokenData.token_type ?? 'Bearer',
        obtained_at: new Date().toISOString(),
        tokenUrl: pending.tokenUrl,
        clientId: pending.clientId,
        clientSecret: pending.clientSecret,
      };

      if (tokenData.refresh_token !== undefined) {
        credential.refresh_token = tokenData.refresh_token;
      }
      if (tokenData.expires_in !== undefined) {
        credential.expires_in = tokenData.expires_in;
      }
      if (tokenData.scope !== undefined) {
        credential.scope = tokenData.scope;
      }

      // Create credential directory if needed
      const credDir = config.oauth.credentialDir;
      await fsp.mkdir(credDir, { recursive: true });

      // Atomic write: temp file + rename
      const credPath = credentialPath(
        credDir,
        pending.provider,
        pending.account,
      );
      const tmpPath = credPath + '.tmp';
      await fsp.writeFile(tmpPath, JSON.stringify(credential, null, 2), 'utf8');
      await fsp.rename(tmpPath, credPath);

      void reply.type('text/html');
      return renderPage(
        `${serverName} — Authorization Complete`,
        'Authorization Complete',
        'Authorization complete &mdash; you may close this tab.',
      );
    } catch (err) {
      void reply.type('text/html').code(502);
      return renderPage(
        `${serverName} — Token Exchange Error`,
        'Token Exchange Error',
        `Failed to exchange authorization code: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  return Promise.resolve();
};
