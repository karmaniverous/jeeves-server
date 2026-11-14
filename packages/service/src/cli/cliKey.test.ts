// @vitest-environment node
/**
 * Key resolution of the CLI's API commands (`--key`, `JEEVES_SERVER_KEY`, `keys._plugin` in `-c`), the 401/403 hint, failure text and patch input.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';

import { ServerError } from '@karmaniverous/jeeves-server-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { computeInsiderKey } from '../util/crypto.js';
import {
  type CliCommand,
  describeFailure,
  readPatch,
  wireApiCommands,
} from './apiCommands.js';
import { KEY_ENV_VAR, keyHint, resolveCliKey } from './cliKey.js';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-cli-key-'));

/** Write a temp file. */
const write = (name: string, content: string) => {
  const file = path.join(tmpDir, name);
  fs.writeFileSync(file, content);
  return file;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveCliKey', () => {
  const config = write('c.json', JSON.stringify({ keys: { _plugin: 'seed' } }));

  it('takes --key, then the env var, then keys._plugin', () => {
    const env = { [KEY_ENV_VAR]: 'from-env' };
    expect(resolveCliKey({ key: 'flag', config }, env)).toBe('flag');
    expect(resolveCliKey({ key: ' ', config }, env)).toBe('from-env');
    expect(resolveCliKey({ config }, {})).toBe(computeInsiderKey('seed'));
    expect(resolveCliKey({}, {})).toBeUndefined();
  });

  it('finds no key in a config without a usable keys._plugin', () => {
    for (const content of [
      '{}',
      'null',
      '{"keys":{"_plugin":"  "}}',
      '{"keys":{"_plugin":{"scopes":[]}}}',
    ])
      expect(
        resolveCliKey({ config: write('n.json', content) }, {}),
      ).toBeUndefined();
  });

  it('reports a config file that is not JSON', () => {
    const file = write('bad.json', '{');
    expect(() => resolveCliKey({ config: file }, {})).toThrow(
      `cannot read keys._plugin from ${file}`,
    );
  });
});

describe('keyHint and describeFailure', () => {
  it('names --key and the env var, never the key', () => {
    for (const sent of [true, false]) {
      expect(keyHint(sent)).toContain('--key <key>');
      expect(keyHint(sent)).toContain(KEY_ENV_VAR);
    }
  });

  it('prints <code>: <message>, with the hint only on 401/403', () => {
    const error = (status: number) =>
      new ServerError({ code: `http_${String(status)}`, status, message: 'm' });
    expect(describeFailure(error(500), true)).toBe('http_500: m');
    expect(describeFailure(error(403), true)).toBe(
      `http_403: m\n${keyHint(true)}`,
    );
    expect(describeFailure(new Error('plain'), false)).toBe('plain');
    expect(describeFailure('text', false)).toBe('text');
  });
});

describe('readPatch', () => {
  /** Replace stdin with a stream of `text`. */
  const stdin = (text: string) =>
    vi
      .spyOn(process, 'stdin', 'get')
      .mockReturnValue(
        Readable.from([Buffer.from(text)]) as typeof process.stdin,
      );

  it('reads a file, else stdin; empty input is {}', async () => {
    await expect(readPatch(write('p.json', '{"a":1}'))).resolves.toEqual({
      a: 1,
    });
    stdin('{"b":2}');
    await expect(readPatch()).resolves.toEqual({ b: 2 });
    stdin('  ');
    await expect(readPatch()).resolves.toEqual({});
  });

  it('refuses anything but a JSON object', async () => {
    for (const text of ['null', '[]', '1'])
      await expect(readPatch(write('x.json', text))).rejects.toThrow(
        'patch must be a JSON object',
      );
    await expect(readPatch(write('y.json', '{'))).rejects.toThrow(SyntaxError);
  });
});

describe('wireApiCommands', () => {
  it('skips commands that are not registered', () => {
    const command = (
      name: string,
      commands: CliCommand[] = [],
    ): CliCommand => ({
      name: () => name,
      commands,
      option: vi.fn(),
      action: vi.fn(),
      opts: () => ({}),
    });
    const bare = command('cli');
    expect(() => {
      wireApiCommands(bare);
    }).not.toThrow();
    const action = vi.fn();
    const config = { ...command('config'), action };
    wireApiCommands(command('cli', [config]));
    expect(action).toHaveBeenCalledOnce();
  });
});
