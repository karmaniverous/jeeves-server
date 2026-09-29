/**
 * Tests for POST /config/apply: patches merge into the runtime config file.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { init, resetInit } from '@karmaniverous/jeeves';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clearConfig, getConfig, initConfig } from '../config/index.js';
import { registerConfigRoute } from './config.js';

const VALID_CONFIG = {
  port: 9999,
  chromePath: '/usr/bin/chromium',
  auth: { modes: ['keys'] },
  keys: {
    primary: 'a'.repeat(64),
    _internal: 'b'.repeat(64),
  },
  events: {},
};

describe('POST /config/apply', () => {
  let tmpDir: string;
  let configPath: string;
  let derivedPath: string;
  let app: FastifyInstance;

  const readConfigFile = (): Record<string, unknown> =>
    JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;

  const apply = (body: unknown) =>
    app.inject({
      method: 'POST',
      url: '/config/apply',
      payload: body as object,
    });

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-config-apply-'));
    // Runtime config (--config) lives outside the core-derived location.
    configPath = path.join(tmpDir, 'runtime', 'jeeves-server', 'config.json');
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(VALID_CONFIG, null, 2));

    // Core configRoot points elsewhere (e.g. the './config' fallback).
    const configRoot = path.join(tmpDir, 'core-root');
    derivedPath = path.join(configRoot, 'jeeves-server', 'config.json');
    init({ workspacePath: tmpDir, configRoot });

    initConfig(configPath);
    app = Fastify();
    registerConfigRoute(app);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    clearConfig();
    resetInit();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('deep-merges a partial patch into the runtime config file', async () => {
    const res = await apply({ patch: { port: 4321 } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ applied: true });

    const written = readConfigFile();
    expect(written.port).toBe(4321);
    expect(written.chromePath).toBe(VALID_CONFIG.chromePath);
    expect(written.keys).toEqual(VALID_CONFIG.keys);
    expect(fs.existsSync(derivedPath)).toBe(false);

    // onConfigApply hot-reloads the singleton from the same file.
    expect(getConfig().port).toBe(4321);
  });

  it('merges nested objects instead of replacing them', async () => {
    const res = await apply({
      patch: { keys: { secondary: 'c'.repeat(64) } },
    });

    expect(res.statusCode).toBe(200);
    expect(readConfigFile().keys).toEqual({
      ...VALID_CONFIG.keys,
      secondary: 'c'.repeat(64),
    });
  });

  it('returns 400 and leaves the file untouched when the merge is invalid', async () => {
    const before = fs.readFileSync(configPath, 'utf8');

    const res = await apply({ patch: { port: 'not-a-port' } });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'Config validation failed' });
    expect(fs.readFileSync(configPath, 'utf8')).toBe(before);
  });

  it('validates replace: true against the full schema', async () => {
    const res = await apply({ patch: { port: 4321 }, replace: true });

    expect(res.statusCode).toBe(400);
    expect(readConfigFile().port).toBe(VALID_CONFIG.port);
  });
});
