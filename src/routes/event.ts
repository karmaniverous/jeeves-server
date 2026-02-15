/**
 * Webhook event endpoint
 */

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import { verifyKey } from '../auth/keys.js';
import { getConfig } from '../config/index.js';
import { appendEvent } from '../services/eventQueue.js';

interface WebhookRequest {
  type?: string;
  team_id?: string;
  api_app_id?: string;
  challenge?: string;
  data?: {
    object?: string;
  };
  api_version?: string;
  _source?: string;
  _event?: string;
}

/**
 * Detect webhook source from headers and body
 */
function detectSource(req: FastifyRequest<{ Body: WebhookRequest }>) {
  const headers = req.headers;
  const body = req.body;

  if (headers['x-notion-signature']) {
    return {
      source: 'notion',
      event: (headers['x-notion-event'] as string) || 'unknown',
    };
  }
  if (headers['x-github-event']) {
    return { source: 'github', event: headers['x-github-event'] as string };
  }
  if (body.type && (body.team_id || body.api_app_id)) {
    return { source: 'slack', event: body.type };
  }
  if (body.type && body.data?.object && body.api_version) {
    return { source: 'stripe', event: body.type };
  }
  if (headers['x-webhook-source']) {
    return {
      source: headers['x-webhook-source'] as string,
      event: (headers['x-webhook-event'] as string) || 'unknown',
    };
  }
  if (body._source) {
    return { source: body._source, event: body._event || 'unknown' };
  }
  return { source: 'unknown', event: 'unknown' };
}

export const eventRoute: FastifyPluginAsync = async (fastify) => {
  // Webhook authentication middleware
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/webhook')) return;

    const provided =
      (request.headers['x-api-key'] as string) ||
      (request.query as { key?: string }).key;
    const config = getConfig();

    const result = verifyKey(config.apiKey, '/webhook', provided, undefined);

    if (!result.valid) {
      appendEvent({ kind: 'auth_failed', ip: request.ip });
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // Webhook endpoint
  fastify.post<{ Body: WebhookRequest }>('/webhook', async (request) => {
    const ctx = detectSource(request);

    // Slack URL verification
    if (request.body.type === 'url_verification' && request.body.challenge) {
      return { challenge: request.body.challenge };
    }

    // Log the event
    appendEvent({ ...ctx, action: 'logged' });

    return { ok: true, message: `${ctx.source} webhook received` };
  });
};
