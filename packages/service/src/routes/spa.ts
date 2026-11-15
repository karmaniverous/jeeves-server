/**
 * The React SPA: built assets under `/app/`, the SPA shell for its browser routes (or the server-side sign-in page for a caller with no credential), and the not-found handler. Browser routes keep HTML; any other unknown route is a `SERVER_NOT_FOUND` 404 in the standard error body.
 *
 * @packageDocumentation
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import fastifyStatic from '@fastify/static';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { NotFound } from '../api/errors.js';
import { resolveSpaAccess } from '../auth/resolve.js';
import { renderSignInPage } from '../auth/signInPage.js';
import { getConfig } from '../config/index.js';
import { injectPageTitle, spaPageTitle } from './spaTitle.js';

/** Browser routes that serve the SPA shell. */
const SPA_ROUTES = [
  '/',
  '/browse',
  '/browse/*',
  '/runner',
  '/runner/*',
  '/readme',
  '/privacy',
  '/terms',
] as const;

/**
 * Whether an unmatched request still belongs to the SPA: a `GET` under
 * `/browse` or `/runner` (dotfile paths the wildcard routes may miss).
 *
 * @param request - The request.
 * @returns `true` for the SPA's own paths.
 */
export function isSpaRequest(
  request: Pick<FastifyRequest, 'method' | 'url'>,
): boolean {
  return (
    request.method === 'GET' &&
    (request.url.startsWith('/browse') || request.url.startsWith('/runner'))
  );
}

/**
 * Register the SPA over `clientDir` (its built `index.html` and assets).
 *
 * @param fastify - The root app.
 * @param clientDir - Directory holding the built client.
 */
export async function registerSpa(
  fastify: FastifyInstance,
  clientDir: string,
): Promise<void> {
  await fastify.register(fastifyStatic, { root: clientDir, prefix: '/app/' });

  // Serve index.html for authenticated requests (with the page's title on
  // /browse/<path>, #262); render the server-side sign-in page for
  // unauthenticated ones.
  const spaFallback = async (request: FastifyRequest, reply: FastifyReply) => {
    const cfg = getConfig();
    const access = resolveSpaAccess(cfg, request);
    if (access.type === 'none') {
      return reply
        .type('text/html')
        .send(renderSignInPage(request.url, cfg.authModes, cfg.branding));
    }
    const title = await spaPageTitle(request.url, access, cfg);
    if (title === null) return reply.sendFile('index.html', clientDir);
    const html = await readFile(path.join(clientDir, 'index.html'), 'utf8');
    return (
      reply
        .type('text/html; charset=utf-8')
        // As @fastify/static sends the plain shell.
        .header('Cache-Control', 'public, max-age=0')
        .send(injectPageTitle(html, title, cfg.branding?.name))
    );
  };

  for (const route of SPA_ROUTES) fastify.get(route, spaFallback);

  fastify.setNotFoundHandler(async (request, reply) => {
    if (isSpaRequest(request)) return spaFallback(request, reply);
    throw new NotFound('Not found');
  });
}
