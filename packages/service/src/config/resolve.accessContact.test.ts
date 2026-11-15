import { describe, expect, it } from 'vitest';

import { buildRuntimeConfig } from './resolve.js';
import type { JeevesConfig } from './schema.js';

const config = (auth: JeevesConfig['auth']): JeevesConfig => ({
  port: 1934,
  eventTimeoutMs: 30000,
  eventLogPurgeMs: 2592000000,
  maxZipSizeMb: 100,
  chromePath: '/usr/bin/chrome',
  scopes: {},
  events: {},
  auth,
  keys: { primary: 'a'.repeat(64) },
  insiders: {},
  go: {},
  eventQueueConcurrency: 3,
  trustProxyHeaders: false,
});

const build = (auth: JeevesConfig['auth']) =>
  buildRuntimeConfig(config(auth), '/srv/jeeves', '/srv/jeeves/config.json');

describe('buildRuntimeConfig: auth.accessContact (#304)', () => {
  it('carries the contact', () => {
    expect(
      build({ modes: ['google'], accessContact: 'ops@example.com' })
        .accessContact,
    ).toBe('ops@example.com');
  });

  it('leaves it unset without one', () => {
    expect(build({ modes: ['keys'] }).accessContact).toBeUndefined();
  });
});
