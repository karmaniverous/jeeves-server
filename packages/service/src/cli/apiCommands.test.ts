// @vitest-environment node
/**
 * The re-wired `status`, `config` and `config apply` commands against a real server (the wire app listening on loopback): output unchanged, the key from `--key`, `JEEVES_SERVER_KEY` or `-c` (`keys._plugin`), and `<code>: <message>` with a key hint on 401/403.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { startWireApp, type WireApp } from '../test/wire/wireApp.js';
import { WIRE_SEEDS } from '../test/wire/wireFixture.js';
import { computeInsiderKey } from '../util/crypto.js';
import { KEY_ENV_VAR } from './cliKey.js';
import { createServerCli } from './program.js';

const ADMIN_KEY = computeInsiderKey(WIRE_SEEDS.primary);
const SCOPED_KEY = computeInsiderKey(WIRE_SEEDS.scopedKey);

let wire: WireApp;
let port: string;
let tmpDir: string;

beforeAll(async () => {
  wire = await startWireApp();
  await wire.app.listen({ host: '127.0.0.1', port: 0 });
  const address = wire.app.server.address();
  port = String(typeof address === 'object' && address ? address.port : 0);
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-cli-api-'));
});

afterAll(async () => {
  await wire.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  wire.reset();
  vi.stubEnv(KEY_ENV_VAR, '');
});

afterEach(() => {
  process.exitCode = undefined;
  vi.unstubAllEnvs();
});

/**
 * Run the CLI in-process.
 *
 * @param args - Arguments after the program name.
 * @returns What it printed and its exit code.
 */
async function cli(...args: string[]) {
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await createServerCli().parseAsync([...args, '--port', port], {
    from: 'user',
  });
  const text = (spy: typeof log) =>
    spy.mock.calls.map((c) => c.join(' ')).join('\n');
  const result = {
    stdout: text(log),
    stderr: text(error),
    exitCode: process.exitCode,
  };
  log.mockRestore();
  error.mockRestore();
  return result;
}

/**
 * Write a file in the temp directory.
 *
 * @param name - File name.
 * @param content - JSON content.
 * @returns Its path.
 */
function writeJson(name: string, content: unknown): string {
  const file = path.join(tmpDir, name);
  fs.writeFileSync(file, JSON.stringify(content));
  return file;
}

describe('status', () => {
  it('prints the status as JSON, without a key', async () => {
    const { stdout, exitCode } = await cli('status');
    expect(exitCode).toBeUndefined();
    expect(JSON.parse(stdout)).toMatchObject({ name: 'server' });
  });

  it('prints the failure when nothing listens', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await createServerCli().parseAsync(['status', '--port', '9'], {
      from: 'user',
    });
    expect(process.exitCode).toBe(1);
    expect(log.mock.calls[0]?.[0]).toMatch(
      /^Service unreachable: network_error: status request failed/,
    );
  });
});

describe('config', () => {
  it('queries with --key, before or after the JSONPath', async () => {
    for (const args of [
      ['config', '$.port', '--key', ADMIN_KEY],
      ['config', '--key', ADMIN_KEY, '$.port'],
    ]) {
      const { stdout, exitCode } = await cli(...args);
      expect(exitCode).toBeUndefined();
      expect(JSON.parse(stdout)).toEqual({ result: [1934], count: 1 });
    }
  });

  it('falls back to JEEVES_SERVER_KEY', async () => {
    vi.stubEnv(KEY_ENV_VAR, ADMIN_KEY);
    const { stdout } = await cli('config', '$.port');
    expect(JSON.parse(stdout)).toMatchObject({ count: 1 });
  });

  it('then to the insider key of keys._plugin in -c', async () => {
    const plain = writeJson('plain.json', {
      keys: { _plugin: WIRE_SEEDS.primary },
    });
    const object = writeJson('object.json', {
      keys: { _plugin: { key: WIRE_SEEDS.primary } },
    });
    for (const file of [plain, object]) {
      const { stdout } = await cli('config', '$.port', '-c', file);
      expect(JSON.parse(stdout)).toMatchObject({ count: 1 });
    }
  });

  it('prefers --key over the env var and the config file', async () => {
    vi.stubEnv(KEY_ENV_VAR, 'wrong');
    const file = writeJson('wrong.json', { keys: { _plugin: 'wrong' } });
    const { stdout } = await cli('config', '--key', ADMIN_KEY, '-c', file);
    expect(JSON.parse(stdout)).toMatchObject({ port: 1934 });
  });

  it('without a key: the code, message and how to supply one', async () => {
    const { stdout, stderr, exitCode } = await cli('config');
    expect(exitCode).toBe(1);
    expect(stdout).toBe('');
    const [first, hint] = stderr.split('\n');
    expect(first).toMatch(/^Config query failed: SERVER_UNAUTHORIZED: /);
    expect(hint).toMatch(/requires an admin key/);
    expect(hint).toContain('--key <key>');
    expect(hint).toContain(KEY_ENV_VAR);
  });

  it('with a scoped key: 403 and a hint that the key was refused', async () => {
    const { stderr, exitCode } = await cli('config', '--key', SCOPED_KEY);
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/^Config query failed: SERVER_FORBIDDEN: /);
    expect(stderr).toContain('The server refused the key');
    expect(stderr).not.toContain(SCOPED_KEY);
  });

  it('reports an unreadable config file', async () => {
    const { stderr, exitCode } = await cli(
      'config',
      '-c',
      path.join(tmpDir, 'none.json'),
    );
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(
      /^Config query failed: cannot read keys\._plugin from /,
    );
  });
});

describe('config apply', () => {
  it('applies a patch file with --key', async () => {
    const patch = writeJson('patch.json', { eventTimeoutMs: 1000 });
    const { stdout, exitCode } = await cli(
      'config',
      'apply',
      '--file',
      patch,
      '--key',
      ADMIN_KEY,
    );
    expect(exitCode).toBeUndefined();
    expect(JSON.parse(stdout)).toMatchObject({ applied: true });
  });

  it('fails without a key, with the hint', async () => {
    const patch = writeJson('patch.json', { eventTimeoutMs: 1000 });
    const { stderr, exitCode } = await cli('config', 'apply', '-f', patch);
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/^Config apply failed: SERVER_UNAUTHORIZED: /);
    expect(stderr).toContain(KEY_ENV_VAR);
  });

  it('refuses a patch that is not a JSON object', async () => {
    const patch = writeJson('array.json', [1]);
    const { stderr } = await cli(
      'config',
      'apply',
      '-f',
      patch,
      '--key',
      ADMIN_KEY,
    );
    expect(stderr).toBe('Config apply failed: patch must be a JSON object');
  });
});
