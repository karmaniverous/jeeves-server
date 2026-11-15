/**
 * The real jeeves-server routes, registered as `server.ts` registers them, over a temp fixture corpus and config, for the wire baseline. Writes temp files; every dependency (watcher, runner, meta, SMTP, PlantUML servers, Chrome) is unreachable, so replies are deterministic.
 *
 * The app is built by `registerServerApp` (`src/app.ts`), as `server.ts`
 * builds it; the harness differs only where a test can't follow `server.ts`:
 * the app is injected rather than listening, the event queue processor isn't
 * started (its commands never run), the export cache lives in the temp
 * directory instead of the working directory, and the SPA is a one-file
 * stub.
 *
 * Portability: the branch base has no `src/app.ts` (its `server.ts` repeated
 * the registration inline), so this file no longer runs there. The baseline
 * was recorded with the harness as of commit `a80c55e`, which inlined the
 * base's registration; re-recording (never needed: the baseline is never
 * edited) would start from that version of this file.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { init } from '@karmaniverous/jeeves';
import Fastify, { type FastifyInstance } from 'fastify';

import { registerServerApp } from '../../app.js';
import { getConfig, initConfig } from '../../config/index.js';
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
/** A route the app registered. */
export interface RegisteredRoute {
  method: string;
  url: string;
}

export interface WireApp extends WireDirs {
  /** Every route the app registered (method, URL pattern). */
  routes: RegisteredRoute[];
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
 * Build the app as `server.ts` does (`registerServerApp`), with the SPA
 * over `clientDir`, recording every route it registers.
 *
 * @param clientDir - SPA directory.
 * @param routes - Receives each registered route.
 * @returns The app, not yet ready.
 */
async function buildApp(
  clientDir: string,
  routes: RegisteredRoute[],
): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: { level: 'silent' } });
  fastify.addHook('onRoute', ({ method, url }) => {
    for (const m of Array.isArray(method) ? method : [method])
      routes.push({ method: m, url });
  });
  await registerServerApp(fastify, { clientDir });
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
  const routes: RegisteredRoute[] = [];
  const app = await buildApp(clientDir, routes);
  await app.ready();
  await awaitServiceProbe(app);

  return {
    ...dirs,
    app,
    routes,
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
