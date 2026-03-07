import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const CLI_PATH = path.resolve(
  import.meta.dirname,
  '../../../dist/src/cli/index.js',
);

const VALID_CONFIG = {
  port: 8765,
  chromePath: '/usr/bin/chromium',
  auth: { modes: ['keys'] },
  keys: {
    primary: 'a'.repeat(64),
    _internal: 'b'.repeat(64),
  },
  events: {},
};

function writeConfig(dir: string, config: unknown): string {
  const filePath = path.join(dir, 'jeeves-server.config.json');
  fs.writeFileSync(filePath, JSON.stringify(config));
  return filePath;
}

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('node', [CLI_PATH, ...args], { timeout: 10_000 });
}

describe('jeeves-server config validate', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-cli-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('validates a valid config and prints summary', async () => {
    const configPath = writeConfig(tmpDir, VALID_CONFIG);
    const { stdout } = await runCli(['config', 'validate', '-c', configPath]);
    expect(stdout).toContain('Configuration valid');
    expect(stdout).toContain('Port: 8765');
    expect(stdout).toContain('Auth modes: keys');
    expect(stdout).toContain('Keys: 2');
  });

  it('exits with error for invalid config', async () => {
    const configPath = writeConfig(tmpDir, { port: 1234 });
    await expect(
      runCli(['config', 'validate', '-c', configPath]),
    ).rejects.toMatchObject({
      code: 1,
    });
  });
});

describe('jeeves-server config show', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-cli-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('shows resolved config with key and insider details', async () => {
    const configPath = writeConfig(tmpDir, {
      ...VALID_CONFIG,
      insiders: { 'test@example.com': {} },
      watcherUrl: 'http://localhost:3458',
    });
    const { stdout } = await runCli(['config', 'show', '-c', configPath]);
    expect(stdout).toContain('Config file:');
    expect(stdout).toContain('port: 8765');
    expect(stdout).toContain('modes: keys');
    expect(stdout).toContain('primary:');
    expect(stdout).toContain('unscoped');
    expect(stdout).toContain('test@example.com');
    expect(stdout).toContain('watcherUrl: http://localhost:3458');
  });

  it('shows scoped keys correctly', async () => {
    const configPath = writeConfig(tmpDir, {
      ...VALID_CONFIG,
      keys: {
        ...VALID_CONFIG.keys,
        scoped: { key: 'c'.repeat(64), scopes: ['/docs'] },
      },
    });
    const { stdout } = await runCli(['config', 'show', '-c', configPath]);
    expect(stdout).toContain('scoped (allow: 1, deny: 0)');
  });
});
