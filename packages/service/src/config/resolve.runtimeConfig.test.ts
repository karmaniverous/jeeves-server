import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildRuntimeConfig } from './resolve.js';
import type { JeevesConfig } from './schema.js';

describe('buildRuntimeConfig', () => {
  const baseConfig = {
    port: 1934,
    eventTimeoutMs: 30000,
    eventLogPurgeMs: 2592000000,
    maxZipSizeMb: 100,
    chromePath: '/usr/bin/chrome',
    scopes: {},
    events: {},
    auth: { modes: ['keys' as const] },
    keys: { primary: 'a'.repeat(64) },
    insiders: {},
    go: {},
    eventQueueConcurrency: 3,
    trustProxyHeaders: false,
  } as JeevesConfig;

  it('constructs correct path fields', () => {
    const result = buildRuntimeConfig(
      baseConfig,
      '/srv/jeeves',
      '/srv/jeeves/config.json',
    );

    expect(result.eventsLog).toBe(
      path.join('/srv/jeeves', 'logs', 'webhook-events.jsonl'),
    );
    expect(result.configPath).toBe('/srv/jeeves/config.json');
    expect(result.port).toBe(1934);
    expect(result.authModes).toEqual(['keys']);
  });

  it('falls back to rootDir/logs when eventQueue is not set', () => {
    const result = buildRuntimeConfig(
      baseConfig,
      '/srv/jeeves',
      '/srv/jeeves/config.json',
    );

    expect(result.eventQueuePath).toBe(
      path.join('/srv/jeeves', 'logs', 'event-queue.jsonl'),
    );
    expect(result.eventQueueCursorPath).toBe(
      path.join('/srv/jeeves', 'logs', 'event-queue.cursor'),
    );
    expect(result.eventsLog).toBe(
      path.join('/srv/jeeves', 'logs', 'webhook-events.jsonl'),
    );
    expect(result.eventLogPath).toBe(
      path.join('/srv/jeeves', 'logs', 'event-log.jsonl'),
    );
  });

  it('resolves all event paths from eventQueue parent dir when set', () => {
    const config = {
      ...baseConfig,
      eventQueue: '/var/state/server/event-queue.jsonl',
    } as JeevesConfig;

    const result = buildRuntimeConfig(
      config,
      '/srv/jeeves',
      '/srv/jeeves/config.json',
    );

    expect(result.eventQueuePath).toBe('/var/state/server/event-queue.jsonl');
    expect(result.eventQueueCursorPath).toBe(
      '/var/state/server/event-queue.jsonl.cursor',
    );
    expect(result.eventsLog).toBe(
      path.join('/var/state/server', 'webhook-events.jsonl'),
    );
    expect(result.eventLogPath).toBe(
      path.join('/var/state/server', 'event-log.jsonl'),
    );
  });

  it('passes through publicUrl when configured', () => {
    const config = {
      ...baseConfig,
      publicUrl: 'https://docs.example.com',
    } as JeevesConfig;

    const result = buildRuntimeConfig(
      config,
      '/srv/jeeves',
      '/srv/jeeves/config.json',
    );

    expect(result.publicUrl).toBe('https://docs.example.com');
  });

  it('leaves publicUrl undefined when not configured', () => {
    const result = buildRuntimeConfig(
      baseConfig,
      '/srv/jeeves',
      '/srv/jeeves/config.json',
    );

    expect(result.publicUrl).toBeUndefined();
  });

  it.each([true, false])(
    'passes through trustProxyHeaders (%s)',
    (trustProxyHeaders) => {
      const config = { ...baseConfig, trustProxyHeaders };

      const result = buildRuntimeConfig(
        config,
        '/srv/jeeves',
        '/srv/jeeves/config.json',
      );

      expect(result.trustProxyHeaders).toBe(trustProxyHeaders);
    },
  );

  it('passes through eventQueueConcurrency', () => {
    const config = {
      ...baseConfig,
      eventQueueConcurrency: 5,
    };

    const result = buildRuntimeConfig(
      config,
      '/srv/jeeves',
      '/srv/jeeves/config.json',
    );

    expect(result.eventQueueConcurrency).toBe(5);
  });
});
