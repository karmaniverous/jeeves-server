/**
 * Shared route-test helpers for the `fileMutations` test split: a fake
 * Fastify reply and a handler wrapper that calls `fileMutationHandlers.fileMutate`
 * directly (bypassing the catalog's own request validation, which the wire
 * baseline already covers).
 *
 * @packageDocumentation
 */

import { withErrorBody } from '../../testing/testApp.js';

export type Reply = ReturnType<typeof createReply>;
export type Handler = (
  request: Record<string, unknown>,
  reply: Reply,
) => Promise<unknown>;

/** A fake Fastify reply that records the status code and sent body. */
export function createReply() {
  let statusCode = 200;
  let sentData: unknown = null;
  const reply = {
    code: (c: number) => {
      statusCode = c;
      return reply;
    },
    send: (data: unknown) => {
      sentData = data;
      return reply;
    },
    get statusCode() {
      return statusCode;
    },
    get sentData() {
      return sentData;
    },
  };
  return reply;
}

/**
 * The fileMutate handler as a route handler: the catalog's request
 * validation is not applied (the wire baseline covers it), so these tests
 * reach the handler's own checks.
 */
export async function setupRoute(): Promise<Handler> {
  const { fileMutationHandlers } = await import('./fileMutations.js');
  return withErrorBody(async (request, reply) => {
    const { status, body } = await fileMutationHandlers.fileMutate(
      {
        params: request.params,
        query: {},
        body: request.body ?? {},
      } as never,
      request as never,
    );
    return reply.code(status).send(body);
  });
}
