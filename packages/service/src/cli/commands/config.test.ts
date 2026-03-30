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
  // Write to the new convention path: {dir}/jeeves-server/config.json
  const configDir = path.join(dir, 'jeeves-server');
  fs.mkdirSync(configDir, { recursive: true });
  const filePath = path.join(configDir, 'config.json');
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

  it('validates a valid config and prints success', async () => {
    const configPath = writeConfig(tmpDir, VALID_CONFIG);
    const { stdout } = await runCli(['config', 'validate', '-c', configPath]);
    expect(stdout).toContain('Config is valid');
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
