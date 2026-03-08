/**
 * Server status endpoint — structured metadata for diagnostics and TOOLS.md generation.
 *
 * Returns version, uptime, port, connected services reachability,
 * event schemas, insider count (no PII), and export capabilities.
 */

import type { FastifyPluginAsync } from 'fastify';

import { getConfig } from '../../config/index.js';
import { packageVersion } from '../../util/packageVersion.js';

const startTime = Date.now();

interface ServiceStatus {
  url: string;
  reachable: boolean;
  version?: string;
}

async function checkService(url: string): Promise<ServiceStatus> {
  // Try /status first (watcher), then /health (runner)
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

// eslint-disable-next-line @typescript-eslint/require-await
export const statusRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/status', async () => {
    const config = getConfig();

    const [watcher, runner] = await Promise.all([
      config.watcherUrl ? checkService(config.watcherUrl) : null,
      config.runnerUrl ? checkService(config.runnerUrl) : null,
    ]);

    return {
      version: packageVersion,
      uptime: Math.floor((Date.now() - startTime) / 1000),
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
      },
    };
  });
};
