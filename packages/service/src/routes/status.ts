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
import type { FastifyPluginAsync } from 'fastify';

import { getConfig } from '../config/index.js';
import { packageVersion } from '../util/packageVersion.js';

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

const handleStatus = createStatusHandler({
  name: 'server',
  version: packageVersion,
  // eslint-disable-next-line @typescript-eslint/require-await
  getHealth: async () => {
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

    return {
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
        : { name: 'Jeeves Server', emoji: '🎩' },
    };
  },
});

// eslint-disable-next-line @typescript-eslint/require-await
export const statusRoutes: FastifyPluginAsync = async (fastify) => {
  let refreshTimer: ReturnType<typeof setInterval> | null = null;

  // Fire-and-forget initial cache population.
  void refreshServiceCache();

  // Refresh every 60 seconds.
  refreshTimer = setInterval(() => {
    void refreshServiceCache();
  }, 60_000);

  // Clean up on shutdown.
  // eslint-disable-next-line @typescript-eslint/require-await
  fastify.addHook('onClose', async () => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  });

  fastify.get('/status', async () => {
    const result = await handleStatus();
    return result.body;
  });
};
