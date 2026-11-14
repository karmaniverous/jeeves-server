/**
 * The real jeeves-server routes, registered as `server.ts` registers them, over a temp fixture corpus and config, for the wire baseline. Writes temp files; every dependency (watcher, runner, meta, SMTP, PlantUML servers, Chrome) is unreachable, so replies are deterministic.
 *
 * The harness must stay portable to the branch base (`scripts/capture-wire.ts`
 * copies it there): it may only import service modules that exist at that
 * commit. `server.ts` at the base has no app factory (its `start()` listens
 * and exits on failure), so {@link startWireApp} repeats its registration
 * sequence; it differs only where a test can't follow it: the app is
 * injected rather than listening, the event queue processor isn't started
 * (its commands never run), the export cache lives in the temp directory
 * instead of the working directory, and the SPA is a one-file stub.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { init } from '@karmaniverous/jeeves';
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';

import { resolveAuth } from '../../auth/resolve.js';
import { renderSignInPage } from '../../auth/signInPage.js';
import { getConfig, initConfig } from '../../config/index.js';
import { apiRoute } from '../../routes/api/index.js';
import { authRoute } from '../../routes/auth.js';
import { registerConfigRoute } from '../../routes/config.js';
import { eventRoute } from '../../routes/event.js';
import { goRoute } from '../../routes/go.js';
import { keysRoute } from '../../routes/keys.js';
import { magicCallbackRoute } from '../../routes/magicCallback.js';
import { magicVerifyRoute } from '../../routes/magicVerify.js';
import { oauthRoute } from '../../routes/oauth.js';
import { pathRoute } from '../../routes/path/index.js';
import { staticRoutes } from '../../routes/static.js';
import { statusRoutes } from '../../routes/status.js';
import { initDiagramCache } from '../../services/diagramCache.js';
import { initTransport } from '../../services/email.js';
import { initExportCache } from '../../services/exportCache.js';
import { fsPathToUrl, getRoots } from '../../util/platform.js';
import { CLOSED_PORT_URL, guardFetch } from './wireFetchGuard.js';
import { wireConfig, type WireDirs, writeCorpus } from './wireFixture.js';
import { seedCaches } from './wireSeed.js';

/** The service package directory (`packages/service`). */
export const SERVICE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

/** A started wire app. */
export interface WireApp extends WireDirs {
  /** The Fastify app. */
  app: FastifyInstance;
  /** The service package directory. */
  serviceDir: string;
  /** The service package directory as the server writes it in URLs. */
  serviceUrl: string;
  /** Restore corpus, config, caches and event files. */
  reset: () => void;
  /** Close the app, restore `fetch` and remove temp files. */
  close: () => Promise<void>;
}

/**
 * Register the SPA exactly as `server.ts` does, over `clientDir`.
 *
 * @param fastify - The app.
 * @param clientDir - Directory holding `index.html`.
 */
async function registerSpa(
  fastify: FastifyInstance,
  clientDir: string,
): Promise<void> {
  await fastify.register(fastifyStatic, { root: clientDir, prefix: '/app/' });
  const spaFallback = async (request: FastifyRequest, reply: FastifyReply) => {
    const cfg = getConfig();
    const auth = resolveAuth(cfg, request);
    if (auth.type === 'none') {
      return reply
        .type('text/html')
        .send(renderSignInPage(request.url, cfg.authModes, cfg.branding));
    }
    return reply.sendFile('index.html', clientDir);
  };
  for (const route of [
    '/',
    '/browse',
    '/browse/*',
    '/runner',
    '/runner/*',
    '/readme',
    '/privacy',
    '/terms',
  ]) {
    fastify.get(route, spaFallback);
  }
  fastify.setNotFoundHandler(async (request, reply) => {
    if (
      request.method === 'GET' &&
      (request.url.startsWith('/browse') || request.url.startsWith('/runner'))
    ) {
      return spaFallback(request, reply);
    }
    return reply.code(404).send({ error: 'Not found' });
  });
}

/**
 * Build the app with `server.ts`'s plugins, hooks and routes, in its order.
 *
 * @param clientDir - SPA directory.
 * @returns The app, not yet ready.
 */
async function buildApp(clientDir: string): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: { level: 'silent' } });
  await fastify.register(cookie);
  fastify.addHook('onSend', async (_request, reply) => {
    void reply.header('X-Robots-Tag', 'noindex, nofollow');
  });
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
  await registerSpa(fastify, clientDir);
  return fastify;
}

/**
 * Wait until `/status` has finished its first (failing) probe of the
 * downstream services, so every recording sees the same cache.
 *
 * @param app - The ready app.
 */
async function awaitServiceProbe(app: FastifyInstance): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt++) {
    const res = await app.inject({ method: 'GET', url: '/status' });
    const body = res.json<{
      health: { services: { lastChecked: string | null } };
    }>();
    if (body.health.services.lastChecked !== null) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('wire: /status never probed the services');
}

/**
 * Start the wire app.
 *
 * @returns The started app; call `close` in `afterAll`.
 */
export async function startWireApp(): Promise<WireApp> {
  const dir = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-server-wire-')),
  );
  const contentDir = path.join(dir, 'content');
  const configRoot = path.join(dir, 'config');
  const clientDir = path.join(dir, 'client');
  const configPath = path.join(dir, 'jeeves-server', 'config.json');

  fs.mkdirSync(path.join(configRoot, 'jeeves-core'), { recursive: true });
  fs.mkdirSync(path.dirname(configPath));
  const service = { url: CLOSED_PORT_URL };
  fs.writeFileSync(
    path.join(configRoot, 'jeeves-core', 'config.json'),
    JSON.stringify({
      services: { watcher: service, runner: service, meta: service },
    }),
  );
  fs.mkdirSync(clientDir);
  fs.writeFileSync(
    path.join(clientDir, 'index.html'),
    '<!doctype html><title>wire spa</title>\n',
  );
  init({ workspacePath: dir, configRoot });

  const rootUrl = fsPathToUrl(contentDir, getRoots({ wireroot: contentDir }));
  const dirs: WireDirs = { dir, contentDir, rootUrl };
  const config = JSON.stringify(wireConfig(dirs), null, 2);
  const exportCacheDir = path.join(dir, 'export-cache');
  const eventsDir = path.join(dir, 'events');
  const oauthDir = path.join(dir, 'oauth');

  const reset = () => {
    writeCorpus(contentDir);
    fs.writeFileSync(configPath, config);
    initConfig(configPath);
    for (const d of [eventsDir, oauthDir]) {
      fs.rmSync(d, { recursive: true, force: true, maxRetries: 3 });
      fs.mkdirSync(d, { recursive: true });
    }
    const cfg = getConfig();
    initDiagramCache(cfg.diagramCachePath);
    initExportCache(exportCacheDir);
    seedCaches({ contentDir, exportCacheDir, oauthDir });
  };

  const restoreFetch = guardFetch();
  reset();
  const cfg = getConfig();
  if (cfg.authModes.includes('email') && cfg.emailAuth)
    initTransport(cfg.emailAuth.smtpUrl);
  const app = await buildApp(clientDir);
  await app.ready();
  await awaitServiceProbe(app);

  return {
    ...dirs,
    app,
    serviceDir: SERVICE_DIR,
    serviceUrl: fsPathToUrl(SERVICE_DIR, getRoots(cfg.roots)),
    reset,
    close: async () => {
      await app.close();
      restoreFetch();
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    },
  };
}
