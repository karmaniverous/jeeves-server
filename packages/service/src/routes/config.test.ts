/**
 * Tests for GET /config route sanitization logic.
 */

import { describe, expect, it } from 'vitest';

import type { RuntimeConfig } from '../config/types.js';
import { sanitizeConfig } from './config.js';

/** Minimal RuntimeConfig fixture with sensitive fields populated. */
function makeConfig(overrides: Partial<RuntimeConfig> = {}): RuntimeConfig {
  return {
    port: 1934,
    eventTimeoutMs: 30_000,
    eventLogPurgeMs: 604_800_000,
    maxZipSizeMb: 100,
    chromePath: '/usr/bin/chromium',
    plantuml: { servers: [] },
    outsiderPolicy: null,
    events: {},
    authModes: ['keys'],
    resolvedKeys: [
      {
        name: 'primary',
        seed: 'secret-key-seed-abc',
        scopes: null,
      },
    ],
    resolvedInsiders: [
      {
        email: 'jason@example.com',
        seed: 'secret-insider-seed-xyz',
        scopes: null,
        keyCreatedAt: '2026-01-01T00:00:00Z',
      },
    ],
    googleAuth: {
      clientId: 'public-client-id',
      clientSecret: 'super-secret-oauth-secret',
    },
    sessionSecret: 'session-hmac-secret',
    internalInsiderKey: 'internal-key-seed',
    oauth: null,
    go: {},
    configPath: '/etc/jeeves-server.config.json',
    eventsLog: '/var/log/events.log',
    eventQueuePath: '/var/queue.jsonl',
    eventQueueCursorPath: '/var/cursor.json',
    eventLogPath: '/var/event-log.jsonl',
    eventQueueConcurrency: 3,
    ...overrides,
  };
}

describe('sanitizeConfig', () => {
  it('redacts sessionSecret', () => {
    const result = sanitizeConfig(makeConfig()) as Record<string, unknown>;
    expect(result.sessionSecret).toBe('[REDACTED]');
  });

  it('returns null for sessionSecret when not configured', () => {
    const result = sanitizeConfig(
      makeConfig({ sessionSecret: null }),
    ) as Record<string, unknown>;
    expect(result.sessionSecret).toBeNull();
  });

  it('redacts internalInsiderKey', () => {
    const result = sanitizeConfig(makeConfig()) as Record<string, unknown>;
    expect(result.internalInsiderKey).toBe('[REDACTED]');
  });

  it('redacts googleAuth.clientSecret but preserves clientId', () => {
    const result = sanitizeConfig(makeConfig()) as Record<string, unknown>;
    const auth = result.googleAuth as {
      clientId: string;
      clientSecret: string;
    };
    expect(auth.clientId).toBe('public-client-id');
    expect(auth.clientSecret).toBe('[REDACTED]');
  });

  it('returns null for googleAuth when not configured', () => {
    const result = sanitizeConfig(makeConfig({ googleAuth: null })) as Record<
      string,
      unknown
    >;
    expect(result.googleAuth).toBeNull();
  });

  it('redacts all key seeds', () => {
    const config = makeConfig({
      resolvedKeys: [
        { name: 'a', seed: 'seed-a', scopes: null },
        { name: 'b', seed: 'seed-b', scopes: null },
      ],
    });
    const result = sanitizeConfig(config) as Record<string, unknown>;
    const keys = result.resolvedKeys as Array<{ name: string; seed: string }>;
    expect(keys).toHaveLength(2);
    expect(keys[0].name).toBe('a');
    expect(keys[0].seed).toBe('[REDACTED]');
    expect(keys[1].seed).toBe('[REDACTED]');
  });

  it('redacts all insider seeds but preserves other fields', () => {
    const result = sanitizeConfig(makeConfig()) as Record<string, unknown>;
    const insiders = result.resolvedInsiders as Array<{
      email: string;
      seed: string;
      keyCreatedAt: string;
    }>;
    expect(insiders[0].email).toBe('jason@example.com');
    expect(insiders[0].seed).toBe('[REDACTED]');
    expect(insiders[0].keyCreatedAt).toBe('2026-01-01T00:00:00Z');
  });

  it('preserves non-sensitive fields', () => {
    const result = sanitizeConfig(makeConfig()) as Record<string, unknown>;
    expect(result.port).toBe(1934);
    expect(result.chromePath).toBe('/usr/bin/chromium');
    expect(result.configPath).toBe('/etc/jeeves-server.config.json');
  });

  it('never leaks raw secret values', () => {
    const config = makeConfig();
    const json = JSON.stringify(sanitizeConfig(config));
    expect(json).not.toContain('secret-key-seed-abc');
    expect(json).not.toContain('secret-insider-seed-xyz');
    expect(json).not.toContain('super-secret-oauth-secret');
    expect(json).not.toContain('session-hmac-secret');
    expect(json).not.toContain('internal-key-seed');
  });
});
