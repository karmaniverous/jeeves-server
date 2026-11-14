/**
 * Everything jeeves-server registers on its Fastify app, in order: plugins, the response-header hook, the error handler, every route and (when the client is built) the SPA. `server.ts` and the wire harness both build the app here.
 *
 * @packageDocumentation
 */

import cookie from '@fastify/cookie';
import { registerErrorHandlers } from '@karmaniverous/jeeves/fastify';
import type { FastifyInstance } from 'fastify';

import { apiRoute } from './routes/api/index.js';
import { authRoute } from './routes/auth.js';
import { registerConfigRoute } from './routes/config.js';
import { eventRoute } from './routes/event.js';
import { goRoute } from './routes/go.js';
import { keysRoute } from './routes/keys.js';
import { magicCallbackRoute } from './routes/magicCallback.js';
import { magicVerifyRoute } from './routes/magicVerify.js';
import { oauthRoute } from './routes/oauth.js';
import { pathRoute } from './routes/path/index.js';
import { registerSpa } from './routes/spa.js';
import { staticRoutes } from './routes/static.js';
import { statusRoutes } from './routes/status.js';

/** Options for {@link registerServerApp}. */
export interface ServerAppOptions {
  /** Directory of the built client; the SPA is registered only when set. */
  clientDir?: string;
}

/**
 * Register jeeves-server's plugins, hooks, error handler and routes.
 *
 * @remarks
 * Errors (#315): `registerErrorHandlers` answers every JSON route with
 * Fastify's standard error body, logging through the app's own (pino)
 * logger: a `defineError` error (`api/errors.ts`) or a Fastify 4xx keeps
 * its status, code and message, anything else is a masked 500. Browser
 * routes send their own HTML pages and redirects.
 *
 * @param fastify - A new Fastify app.
 * @param options - Where the built client is.
 */
export async function registerServerApp(
  fastify: FastifyInstance,
  options: ServerAppOptions = {},
): Promise<void> {
  await fastify.register(cookie);

  // X-Robots-Tag on all responses: invisible to search engines.
  fastify.addHook('onSend', async (_request, reply) => {
    void reply.header('X-Robots-Tag', 'noindex, nofollow');
  });

  registerErrorHandlers(fastify, { logger: fastify.log });

  await fastify.register(staticRoutes);
  registerConfigRoute(fastify);
  await fastify.register(statusRoutes);
  await fastify.register(authRoute);
  await fastify.register(magicCallbackRoute);
  await fastify.register(magicVerifyRoute);
  await fastify.register(oauthRoute);
  await fastify.register(keysRoute);
  await fastify.register(eventRoute);
  await fastify.register(goRoute);
  await fastify.register(apiRoute);
  await fastify.register(pathRoute);

  if (options.clientDir) await registerSpa(fastify, options.clientDir);
}
