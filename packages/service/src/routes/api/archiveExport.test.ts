/**
 * Tests for scope-aware directory archive export (#271).
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccessMode, NormalizedScopes } from '../../config/types.js';

const config = { maxZipSizeMb: 1 };
vi.mock('../../config/index.js', () => ({ getConfig: () => config }));

const { isArchiveFormat, sendDirectoryArchive } =
  await import('./archiveExport.js');

const noSecrets: NormalizedScopes = {
  allow: ['/j/**'],
  deny: ['/j/docs/secrets/**'],
  explicitAllow: [],
  explicitDeny: [],
};

let tmpDir = '';

function write(rel: string, content: string | Buffer) {
  const p = path.join(tmpDir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

async function buildApp(
  accessMode: AccessMode,
  scopes: NormalizedScopes | null,
  format: 'zip' | 'tar' = 'tar',
): Promise<FastifyInstance> {
  const app = Fastify();
  app.get('/archive', async (request, reply) => {
    request.accessMode = accessMode;
    request.insiderScopes = scopes;
    return sendDirectoryArchive(
      request,
      reply,
      path.join(tmpDir, 'docs'),
      'j/docs',
      format,
    );
  });
  await app.ready();
  return app;
}

describe('isArchiveFormat', () => {
  it.each([
    ['zip', true],
    ['tar', true],
    ['pdf', false],
    ['', false],
  ])('%s → %s', (format, expected) => {
    expect(isArchiveFormat(format)).toBe(expected);
  });
});

describe('sendDirectoryArchive', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-archive-'));
    write('docs/readme.md', 'public');
    write('docs/secrets/key.pem', 'TOP-SECRET-CONTENT');
    config.maxZipSizeMb = 1;
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('requires insider access', async () => {
    app = await buildApp('outsider', null);
    const res = await app.inject({ url: '/archive' });
    expect(res.statusCode).toBe(403);
  });

  it('archives everything for an unscoped insider', async () => {
    app = await buildApp('insider', null);
    const res = await app.inject({ url: '/archive' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/x-tar');
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="docs.tar"',
    );
    expect(res.body).toContain('docs/readme.md');
    expect(res.body).toContain('TOP-SECRET-CONTENT');
  });

  it('streams a zip archive', async () => {
    app = await buildApp('insider', null, 'zip');
    const res = await app.inject({ url: '/archive' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/zip');
    expect(res.rawPayload.subarray(0, 2).toString()).toBe('PK');
  });

  it('omits denied entries (names and content) for a scoped insider', async () => {
    app = await buildApp('insider', noSecrets);
    const res = await app.inject({ url: '/archive' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('docs/readme.md');
    expect(res.body).not.toContain('secrets');
    expect(res.body).not.toContain('TOP-SECRET-CONTENT');
  });

  describe('size limit', () => {
    beforeEach(() => {
      // 2 MB of denied content; the permitted content is tiny.
      write('docs/secrets/big.bin', Buffer.alloc(2 * 1024 * 1024));
    });

    it('rejects with 413 when the archived content exceeds the limit', async () => {
      app = await buildApp('insider', null);
      const res = await app.inject({ url: '/archive' });
      expect(res.statusCode).toBe(413);
      expect(res.json<{ error: string }>().error).toContain('2MB, max 1MB');
    });

    it('counts only in-scope content, so denied bulk neither blocks nor leaks', async () => {
      app = await buildApp('insider', noSecrets);
      const res = await app.inject({ url: '/archive' });
      expect(res.statusCode).toBe(200);
      expect(res.body).not.toContain('big.bin');
    });
  });
});
