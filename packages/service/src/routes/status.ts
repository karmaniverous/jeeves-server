/**
 * Server status endpoint — uses the SDK's createStatusHandler factory.
 *
 * Returns standard { name, version, uptime, status, health } shape
 * with server-specific details nested under health.
 */

import { createStatusHandler } from '@karmaniverous/jeeves';
import type { FastifyPluginAsync } from 'fastify';

import { getConfig } from '../config/index.js';
import { packageVersion } from '../util/packageVersion.js';

interface ServiceStatus {
  url: string;
  reachable: boolean;
  version?: string;
}

async function checkService(url: string): Promise<ServiceStatus> {
  for (const endpoint of ['/status', '/health']) {
    try {
      const res = await fetch(`${url}${endpoint}`, {
        signal: AbortSignal.timeout(3000),
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

const handleStatus = createStatusHandler({
  name: 'server',
  version: packageVersion,
  getHealth: async () => {
    const config = getConfig();

    const [watcher, runner, meta] = await Promise.all([
      config.watcherUrl ? checkService(config.watcherUrl) : null,
      config.runnerUrl ? checkService(config.runnerUrl) : null,
      config.metaUrl ? checkService(config.metaUrl) : null,
    ]);

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
      services: {
        watcher,
        runner,
        meta,
      },
    };
  },
});

export const statusRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/status', async () => {
    const result = await handleStatus();
    return result.body;
  });
};
