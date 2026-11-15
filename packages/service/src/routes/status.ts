/**
 * Server status endpoint — uses the SDK's `createStatusHandler` factory.
 *
 * Returns standard `{ name, version, uptime, status, health }` shape
 * with server-specific details nested under `health`.
 *
 * Service health checks (watcher, runner, meta) are cached in the
 * background on a 60-second interval to avoid blocking the response.
 */

import { createStatusHandler, getServiceUrl } from '@karmaniverous/jeeves';
import type { FastifyPluginCallback, FastifyRequest } from 'fastify';

import { isAdmin } from '../api/accessHook.js';
import { type HandlersFor, ok } from '../api/handlerTypes.js';
import { getConfig } from '../config/index.js';
import { DEFAULT_BRANDING } from '../config/schema.js';
import { getEventQueueHealth } from '../services/queueHealth.js';
import { packageVersion } from '../util/packageVersion.js';
import { statusRedirectUris } from '../util/redirectUris.js';

/** Health status of a single downstream service. */
interface ServiceStatus {
  url: string;
  reachable: boolean;
  version?: string;
}

/** Background cache for downstream service health checks. */
interface ServiceCache {
  watcher: ServiceStatus;
  runner: ServiceStatus;
  meta: ServiceStatus;
  lastChecked: string;
}

let serviceCache: ServiceCache | null = null;

/**
 * Probe a single service's health endpoint.
 *
 * Tries `/status` then `/health`, returning the first successful
 * response. Times out after 1 500 ms per attempt.
 */
async function checkService(url: string): Promise<ServiceStatus> {
  for (const endpoint of ['/status', '/health']) {
    try {
      const res = await fetch(`${url}${endpoint}`, {
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) {
        const data = (await res.json()) as { version?: string };
        return { url, reachable: true, version: data.version };
      }
    } catch {
      // try next endpoint
    }
  }
  return { url, reachable: false };
}

/** Refresh the background service-health cache. */
async function refreshServiceCache(): Promise<void> {
  try {
    const [watcher, runner, meta] = await Promise.all([
      checkService(getServiceUrl('watcher')),
      checkService(getServiceUrl('runner')),
      checkService(getServiceUrl('meta')),
    ]);

    serviceCache = {
      watcher,
      runner,
      meta,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to refresh service status cache:', error);
  }
}

/** The parts of a status body {@link withoutAdminDetails} reads. */
interface StatusBody {
  health?: unknown;
}

/** The `health` fields only admins see. */
interface AdminHealth {
  chrome?: { configured: boolean; path?: unknown };
  events?: { name: string; cmd?: unknown }[];
}

/**
 * A status body for a caller that isn't admin (Decision 22): each
 * `health.events[].cmd` and `health.chrome.path` omitted, the rest as is.
 *
 * @param body - The full status body.
 * @returns The body without them.
 */
export function withoutAdminDetails<B extends StatusBody>(body: B): B {
  const health = body.health as AdminHealth | undefined;
  if (!health) return body;
  return {
    ...body,
    health: {
      ...health,
      ...(health.chrome
        ? { chrome: { configured: health.chrome.configured } }
        : {}),
      ...(health.events
        ? { events: health.events.map(({ name }) => ({ name })) }
        : {}),
    },
  };
}

/**
 * A status body with the sign-in redirect URIs (#270) added to
 * `health.auth`; they depend on the request when the public origin comes
 * from trusted proxy headers.
 *
 * @param body - The status body.
 * @param uris - The redirect URIs that apply.
 * @returns The body with them.
 */
export function withRedirectUris<B extends StatusBody>(
  body: B,
  uris: ReturnType<typeof statusRedirectUris>,
): B {
  const health = body.health as { auth?: object } | undefined;
  if (!health?.auth) return body;
  return { ...body, health: { ...health, auth: { ...health.auth, ...uris } } };
}

const handleStatus = createStatusHandler({
  name: 'server',
  version: packageVersion,
  getHealth: () => {
    const config = getConfig();

    const services = serviceCache
      ? {
          watcher: serviceCache.watcher,
          runner: serviceCache.runner,
          meta: serviceCache.meta,
          lastChecked: serviceCache.lastChecked,
        }
      : {
          watcher: {
            url: getServiceUrl('watcher'),
            reachable: false,
          },
          runner: {
            url: getServiceUrl('runner'),
            reachable: false,
          },
          meta: {
            url: getServiceUrl('meta'),
            reachable: false,
          },
          lastChecked: null,
        };

    return Promise.resolve({
      port: config.port,
      chrome: {
        configured: Boolean(config.chromePath),
        path: config.chromePath,
      },
      auth: {
        modes: config.authModes,
        insiderCount: config.resolvedInsiders.length,
        keyCount: config.resolvedKeys.length,
      },
      events: Object.entries(config.events).map(([name, schema]) => ({
        name,
        cmd: schema.cmd,
      })),
      eventQueue: getEventQueueHealth(),
      exports: {
        documents: ['pdf', 'docx'],
        directories: ['zip'],
        diagrams: ['svg', 'png'],
        chromeAvailable: Boolean(config.chromePath),
      },
      diagrams: {
        mermaid: true,
        plantuml: {
          localJar: Boolean(config.plantuml.jarPath),
          servers: config.plantuml.servers,
        },
      },
      services,
      branding: config.branding
        ? {
            name: config.branding.name,
            emoji: config.branding.emoji,
            theme: config.branding.theme,
          }
        : DEFAULT_BRANDING,
    });
  },
});

/**
 * Probe the downstream services in the background (now, then every 60
 * seconds) for `/status`, until the app closes.
 *
 * @param fastify - The app.
 * @param _opts - Unused.
 * @param done - Plugin callback.
 */
export const serviceProbe: FastifyPluginCallback = (fastify, _opts, done) => {
  void refreshServiceCache();
  const refreshTimer = setInterval(() => {
    void refreshServiceCache();
  }, 60_000);
  fastify.addHook('onClose', (_app, closed) => {
    clearInterval(refreshTimer);
    closed();
  });
  done();
};

/**
 * The `status` body for a request: the redirect URIs added (#270), and
 * the admin-only details omitted for callers that aren't admin (Decision
 * 22).
 *
 * @param body - The full status body.
 * @param request - The request.
 * @returns The body to send.
 */
export function statusBodyFor<B extends StatusBody>(
  body: B,
  request: FastifyRequest,
): B {
  const full = withRedirectUris(body, statusRedirectUris(getConfig(), request));
  return isAdmin(request) ? full : withoutAdminDetails(full);
}

/** The core status handler (`createStatusHandler`). */
export { handleStatus };

/** `health`: the unauthenticated liveness probe (#259), no downstream checks. */
export const healthHandlers: HandlersFor<'health'> = {
  health: () => Promise.resolve(ok({ ok: true as const })),
};
