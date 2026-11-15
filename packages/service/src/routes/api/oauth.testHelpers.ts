/**
 * Shared route-test helpers for the `oauth` API route test split: builds
 * the OAuth route handlers (bypassing the catalog's own request validation,
 * which the wire baseline already covers) and a fake Fastify reply that
 * records the status code, body and content type.
 *
 * @packageDocumentation
 */

import { asRouteHandler } from '../../testing/catalogRoutes.js';
import { withErrorBody } from '../../testing/testApp.js';

export type Handler = (req: unknown, reply: unknown) => Promise<unknown>;

/** The OAuth handlers by path, as route-style handlers (no validation). */
export async function buildRoutes(): Promise<
  Record<string, { method: string; handler: Handler }>
> {
  const { oauthApiHandlers } = await import('./oauth.js');
  const route = (
    method: string,
    handler: Parameters<typeof asRouteHandler>[0],
  ) => ({
    method,
    handler: withErrorBody(asRouteHandler(handler)),
  });
  return {
    '/api/oauth/start': route('POST', oauthApiHandlers.oauthStart),
    '/api/oauth/status': route('GET', oauthApiHandlers.oauthStatus),
    '/api/oauth/token': route('GET', oauthApiHandlers.oauthToken),
  };
}

export interface ReplyCapture {
  statusCode: number;
  body: unknown;
  contentType: string;
}

export function buildReply(): {
  reply: Record<string, unknown>;
  capture: ReplyCapture;
} {
  const capture: ReplyCapture = {
    statusCode: 200,
    body: null,
    contentType: '',
  };
  const reply = {
    code: (c: number) => {
      capture.statusCode = c;
      return reply;
    },
    send: (d: unknown) => {
      capture.body = d;
      return d;
    },
    type: (t: string) => {
      capture.contentType = t;
      return reply;
    },
  };
  return { reply, capture };
}
