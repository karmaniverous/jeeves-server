// @vitest-environment node
/**
 * Real child processes. The timeout tests are platform-specific: the Linux
 * one checks the process-group kill (SIGTERM then SIGKILL), the Windows one
 * the `taskkill /T` tree kill; each is skipped on the other platform.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runEventCommand } from './eventCommand.js';

let dir: string;

/** A script that copies stdin to argv[2] and exits 3. */
const ECHO = `
let data = '';
process.stdin.on('data', (c) => (data += c));
process.stdin.on('end', () => {
  require('fs').writeFileSync(process.argv[2], data);
  process.exit(3);
});
`;

/** A script that ignores SIGTERM and starts a child that does too, writing the child's pid to argv[2]. */
const STUBBORN = `
const { spawn } = require('child_process');
process.on('SIGTERM', () => {});
const child = spawn(process.execPath, ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);"], { stdio: 'ignore' });
require('fs').writeFileSync(process.argv[2], String(child.pid));
setInterval(() => {}, 1000);
`;

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evcmd-'));
  fs.writeFileSync(path.join(dir, 'echo.cjs'), ECHO);
  fs.writeFileSync(path.join(dir, 'stubborn.cjs'), STUBBORN);
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('runEventCommand', () => {
  it('pipes the body as JSON to stdin and reports the exit code', async () => {
    const out = path.join(dir, 'out.json');
    const result = await runEventCommand(
      `node ${path.join(dir, 'echo.cjs')} ${out}`,
      { a: 1 },
      10_000,
    );
    expect(result).toMatchObject({ exitCode: 3, timedOut: false });
    expect(JSON.parse(fs.readFileSync(out, 'utf8'))).toEqual({ a: 1 });
  });

  it('reports -1 for a command that cannot be spawned', async () => {
    expect(await runEventCommand('', {}, 10_000)).toMatchObject({
      exitCode: -1,
      timedOut: false,
    });
  });

  /** Run the stubborn script past its timeout; return the result and its child's pid. */
  async function runStubborn() {
    const pidFile = path.join(dir, `child-${String(Date.now())}.pid`);
    const result = await runEventCommand(
      `node ${path.join(dir, 'stubborn.cjs')} ${pidFile}`,
      {},
      1500,
      { graceMs: 500 },
    );
    const childPid = Number(fs.readFileSync(pidFile, 'utf8'));
    for (let i = 0; i < 20 && isAlive(childPid); i += 1)
      await new Promise((r) => setTimeout(r, 100));
    return { result, childAlive: isAlive(childPid) };
  }

  // Linux only: the process group gets SIGTERM, then SIGKILL.
  it.skipIf(process.platform !== 'linux')(
    'kills a command that ignores SIGTERM, and its child, within timeout + grace (Linux)',
    async () => {
      const { result, childAlive } = await runStubborn();
      expect(result.timedOut).toBe(true);
      expect(result.exitCode).toBeNull();
      expect(result.durationMs).toBeLessThan(1500 + 500 + 1000);
      expect(childAlive).toBe(false);
    },
  );

  // Windows only: taskkill /T, then taskkill /T /F.
  it.skipIf(process.platform !== 'win32')(
    'kills a timed-out command and its process tree within timeout + grace (Windows)',
    async () => {
      const { result, childAlive } = await runStubborn();
      expect(result.timedOut).toBe(true);
      expect(result.durationMs).toBeLessThan(1500 + 500 + 2000);
      expect(childAlive).toBe(false);
    },
  );
});
