/**
 * Route-test helpers: a Fastify app with the service's error handling (`registerErrorHandlers`, as `registerServerApp` sets it up) and the exact error bodies it sends — a `SERVER_*` error's standard body, and the masked 500.
 *
 * @packageDocumentation
 */

import { STATUS_CODES } from 'node:http';

import {
  registerErrorHandlers,
  SERVER_ERROR_MESSAGE,
} from '@karmaniverous/jeeves/fastify';
import {
  SERVER_ERROR_STATUS,
  type ServerErrorCode,
} from '@karmaniverous/jeeves-server-core';
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyServerOptions,
} from 'fastify';

/**
 * A new Fastify app with the service's error handler.
 *
 * @param options - Fastify options.
 * @returns The app.
 */
export function testApp(options?: FastifyServerOptions): FastifyInstance {
  const app = Fastify(options);
  registerErrorHandlers(app);
  return app;
}

/** Fastify's standard error body. */
export interface StandardErrorBody {
  statusCode: number;
  code?: string;
  error: string | undefined;
  message: string;
}

/**
 * The exact body a `SERVER_*` error is sent with: core's status for the
 * code, its standard status text and the message.
 *
 * @param code - The code.
 * @param message - The message.
 * @returns The body.
 */
export function serverError(
  code: ServerErrorCode,
  message: string,
): StandardErrorBody {
  const statusCode = SERVER_ERROR_STATUS[code];
  return { statusCode, code, error: STATUS_CODES[statusCode], message };
}

/** A masked 500: no code, jeeves' generic message. */
export const MASKED_500: StandardErrorBody = {
  statusCode: 500,
  error: 'Internal Server Error',
  message: SERVER_ERROR_MESSAGE,
};

/** The reply surface {@link withErrorBody} sends an error through. */
interface ErrorReply {
  code: (statusCode: number) => { send: (body: unknown) => unknown };
}

/**
 * Wrap a route handler a test calls directly (with a fake reply, which
 * must have `code(status).send(body)`) so a thrown error is answered as the
 * error handler answers it: a `SERVER_*` error's standard body, else the
 * masked 500.
 *
 * @param handler - The route handler.
 * @returns The wrapped handler.
 */
export function withErrorBody<Req, Rep>(
  handler: (request: Req, reply: Rep) => Promise<unknown>,
): (request: Req, reply: Rep) => Promise<unknown> {
  return async (request, reply) => {
    try {
      return await handler(request, reply);
    } catch (err) {
      const { statusCode, code, message } = err as Partial<FastifyError>;
      const body: StandardErrorBody =
        typeof code === 'string' &&
        code.startsWith('SERVER_') &&
        statusCode !== undefined
          ? {
              statusCode,
              code,
              error: STATUS_CODES[statusCode],
              message: message ?? '',
            }
          : MASKED_500;
      return (reply as ErrorReply).code(body.statusCode).send(body);
    }
  };
}
