/**
 * Route tests for POST /api/rotate-key, the one rotation route (#292, Decision 20): an insider's seed is rewritten, `insider_key_rotated` is appended to the event log, and the response says what stopped working; machine keys are refused.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { catalogRoutes } from '../../testing/catalogRoutes.js';
import { serverError, testApp } from '../../testing/testApp.js';

const writeSeed = vi.fn(() => Promise.resolve());
const appendEvent = vi.fn();
const resetConfig = vi.fn();

vi.mock('../../config/index.js', () => ({
  getConfig: () => ({
    roots: {},
    resolvedKeys: [],
    resolvedInsiders: [{ email: 'a@x.test', seed: 's', scopes: null }],
  }),
  resetConfig: () => {
    resetConfig();
  },
}));
vi.mock('../../util/configPersist.js', () => ({
  writeInsiderSeedToConfig: writeSeed,
}));
vi.mock('../../services/eventQueue.js', () => ({ appendEvent }));

const { sharingHandlers } = await import('./sharing.js');
const { shareForHandlers } = await import('./shareFor.js');

async function buildApp(email: string | undefined): Promise<FastifyInstance> {
  const app = testApp();
  app.addHook('preHandler', (request, _reply, done) => {
    if (email !== undefined) request.insiderEmail = email;
    done();
  });
  await app.register(
    catalogRoutes({ ...sharingHandlers, ...shareForHandlers }),
  );
  await app.ready();
  return app;
}

const rotate = (app: FastifyInstance) =>
  app.inject({ method: 'POST', url: '/api/rotate-key' });

describe('POST /api/rotate-key', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    writeSeed.mockClear();
    appendEvent.mockClear();
    resetConfig.mockClear();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rotates an insider key, logs the rotation and says what it invalidates', async () => {
    app = await buildApp('A@x.test');
    const res = await rotate(app);

    expect(res.statusCode).toBe(200);
    const body = res.json<{ keyCreatedAt: string }>();
    expect(body).toEqual({
      ok: true,
      keyCreatedAt: body.keyCreatedAt,
      invalidates: ['insiderKey', 'outsiderLinks'],
    });
    expect(writeSeed).toHaveBeenCalledWith(
      'a@x.test',
      expect.stringMatching(/^[0-9a-f]{64}$/u),
      body.keyCreatedAt,
    );
    expect(appendEvent).toHaveBeenCalledWith({
      kind: 'insider_key_rotated',
      email: 'a@x.test',
      at: body.keyCreatedAt,
    });
    expect(resetConfig).toHaveBeenCalledOnce();
  });

  it('refuses a machine key (no insider email)', async () => {
    app = await buildApp(undefined);
    const res = await rotate(app);

    expect(res.json()).toEqual(
      serverError(
        'SERVER_MACHINE_KEY_NOT_ROTATABLE',
        'Machine keys are rotated in the server config, not through this route',
      ),
    );
    expect(writeSeed).not.toHaveBeenCalled();
    expect(appendEvent).not.toHaveBeenCalled();
  });

  it('refuses an email that is no longer an insider', async () => {
    app = await buildApp('gone@x.test');
    const res = await rotate(app);

    expect(res.statusCode).toBe(403);
    expect(appendEvent).not.toHaveBeenCalled();
  });
});
