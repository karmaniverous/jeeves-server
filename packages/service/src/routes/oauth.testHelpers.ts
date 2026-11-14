/**
 * Shared route-test helpers for the `oauth` callback route test split: a
 * fake Fastify instance that captures registered routes, and a fake reply
 * that records the status code, body and content type.
 *
 * @packageDocumentation
 */

export type Handler = (req: unknown, reply: unknown) => Promise<unknown>;

export function buildFastify(): {
  routes: Record<string, { method: string; handler: Handler }>;
  instance: unknown;
} {
  const routes: Record<string, { method: string; handler: Handler }> = {};
  const instance = {
    get: (routePath: string, handler: Handler) => {
      routes[routePath] = { method: 'GET', handler };
    },
  };
  return { routes, instance };
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
