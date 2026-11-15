/**
 * Capture the wire baseline from the branch base (`npm run wire:capture`).
 *
 * Checks a git ref (default: `d7c25ab`, the 3.16.0 branch base: 3.15.0 plus
 * #310, #312, #313) out into a temporary git worktree, installs it, copies
 * the current wire harness (`src/test/wire/*.ts`, tests excluded) and the
 * recording config into it, records every wire scenario against that
 * ref's routes, and writes the records to `src/test/wire/wire-baseline.json`.
 * The worktree is removed afterwards, whether or not the capture succeeds.
 *
 * Usage (from packages/service):
 * `npx tsx scripts/capture-wire.ts [--ref <ref>] [--out <path>]`
 *
 * The harness must be portable to the ref: it may only import service
 * modules that already exist there. Since 3.16.0 T7 `wireApp.ts` builds the
 * app with `registerServerApp` (`src/app.ts`), which the branch base lacks;
 * the portable harness is the one at commit `a80c55e` (restore its
 * `wireApp.ts` before capturing). The baseline is never re-recorded in
 * normal work: changes go in `departures.ts`.
 *
 * @packageDocumentation
 */

import { execFileSync, execSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, '..');
const repo = resolve(pkg, '..', '..');

const { values } = parseArgs({
  options: {
    ref: { type: 'string', default: 'd7c25ab' },
    out: {
      type: 'string',
      default: join(pkg, 'src', 'test', 'wire', 'wire-baseline.json'),
    },
  },
});
const out = resolve(values.out);

/**
 * Run a command, inheriting stdio. On Windows npm/npx are `.cmd` shims that
 * need a shell, so the command runs as one quoted command line there.
 *
 * @param cmd - Executable.
 * @param args - Arguments.
 * @param cwd - Working directory.
 * @param env - Extra environment variables.
 */
const run = (
  cmd: string,
  args: string[],
  cwd: string,
  env: Record<string, string> = {},
): void => {
  const options = {
    cwd,
    stdio: 'inherit' as const,
    env: { ...process.env, ...env },
  };
  if (process.platform === 'win32')
    // The command name stays unquoted: a quoted `.cmd` shim resolves its own
    // directory (%~dp0) against the cwd.
    execSync([cmd, ...args.map((a) => `"${a}"`)].join(' '), options);
  else execFileSync(cmd, args, options);
};

const worktree = mkdtempSync(join(tmpdir(), 'jeeves-server-wire-capture-'));
process.stdout.write(
  `capture: ${values.ref} -> ${out}\nworktree: ${worktree}\n`,
);
run('git', ['worktree', 'add', '--detach', worktree, values.ref], repo);
try {
  run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], worktree);

  const wireSrc = join(pkg, 'src', 'test', 'wire');
  const wireDst = join(worktree, 'packages', 'service', 'src', 'test', 'wire');
  mkdirSync(wireDst, { recursive: true });
  for (const name of readdirSync(wireSrc)) {
    if (name.endsWith('.ts') && !name.endsWith('.test.ts')) {
      copyFileSync(join(wireSrc, name), join(wireDst, name));
    }
  }
  copyFileSync(
    join(pkg, 'vitest.wire-record.config.ts'),
    join(worktree, 'packages', 'service', 'vitest.wire-record.config.ts'),
  );

  run(
    'npx',
    ['vitest', 'run', '--config', 'vitest.wire-record.config.ts'],
    join(worktree, 'packages', 'service'),
    { WIRE_RECORD: out },
  );
  const records = JSON.parse(readFileSync(out, 'utf8')) as object;
  process.stdout.write(
    `capture: wrote ${String(Object.keys(records).length)} records\n`,
  );
} finally {
  // On Windows `git worktree remove` can unregister the worktree and still
  // fail to delete files a just-exited process held; finish the job.
  try {
    run('git', ['worktree', 'remove', '--force', worktree], repo);
  } catch {
    rmSync(worktree, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 500,
    });
    run('git', ['worktree', 'prune'], repo);
  }
}
