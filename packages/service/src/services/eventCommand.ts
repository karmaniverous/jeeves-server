/**
 * Runs one event command (the queue entry's body piped as JSON to stdin) with a timeout that always ends the command and its process tree: on Linux the command gets its own process group, which is sent SIGTERM and, after `EVENT_KILL_GRACE_MS`, SIGKILL; on Windows `taskkill /T`, then `taskkill /T /F`.
 *
 * @packageDocumentation
 */

import { type ChildProcess, execFile, spawn } from 'node:child_process';

/** Grace between the polite and the forced kill of a timed-out command. */
export const EVENT_KILL_GRACE_MS = 5000;

/** What a command run produced. */
export interface CommandResult {
  /** Exit code; null when the process was killed by a signal; -1 when it couldn't start. */
  exitCode: number | null;
  durationMs: number;
  /** True when the timeout fired. */
  timedOut: boolean;
}

/** Options of {@link runEventCommand}. */
export interface RunCommandOptions {
  /** Kill grace (default {@link EVENT_KILL_GRACE_MS}). */
  graceMs?: number;
}

/**
 * Signal a process tree: the process group on POSIX, `taskkill /T` on
 * Windows (`/F` when forced). Errors (the tree already gone) are ignored.
 *
 * @param pid - The command's pid (its group leader on POSIX).
 * @param force - Forced kill.
 * @param platform - The platform.
 */
function killTree(pid: number, force: boolean, platform: NodeJS.Platform) {
  if (platform === 'win32') {
    const args = ['/PID', String(pid), '/T', ...(force ? ['/F'] : [])];
    execFile('taskkill', args, { windowsHide: true }, () => undefined);
    return;
  }
  try {
    process.kill(-pid, force ? 'SIGKILL' : 'SIGTERM');
  } catch {
    // The group has exited.
  }
}

/**
 * Run a command with `body` as JSON on stdin, ending it (and its process
 * tree) after `timeoutMs`. Resolves when the process exits or, at the
 * latest, a grace period after the forced kill was sent.
 *
 * @param cmd - The command line (run through the shell).
 * @param body - The body piped to stdin.
 * @param timeoutMs - The timeout.
 * @param options - Kill grace.
 * @returns The exit code, duration and whether it timed out.
 */
export function runEventCommand(
  cmd: string,
  body: unknown,
  timeoutMs: number,
  options: RunCommandOptions = {},
): Promise<CommandResult> {
  const graceMs = options.graceMs ?? EVENT_KILL_GRACE_MS;
  const { platform } = process;
  const startTime = Date.now();

  return new Promise((resolve) => {
    let proc: ChildProcess;
    try {
      proc = spawn(cmd, {
        stdio: ['pipe', 'inherit', 'inherit'],
        shell: true,
        detached: platform !== 'win32',
        windowsHide: true,
      });
    } catch {
      resolve({ exitCode: -1, durationMs: 0, timedOut: false });
      return;
    }

    let timedOut = false;
    let settled = false;
    let forceTimer: NodeJS.Timeout | undefined;
    let slotTimer: NodeJS.Timeout | undefined;
    const settle = (exitCode: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      clearTimeout(slotTimer);
      // On POSIX a timed-out group can outlive its leader (a shell that
      // died on SIGTERM while its children ignore it): the forced kill
      // still goes out. On Windows the tree dies with its root.
      if (platform === 'win32') clearTimeout(forceTimer);
      resolve({ exitCode, durationMs: Date.now() - startTime, timedOut });
    };

    proc.on('exit', (code) => {
      settle(code);
    });
    proc.on('error', () => {
      settle(-1);
    });
    proc.stdin?.on('error', () => undefined);
    proc.stdin?.end(JSON.stringify(body));

    const timeoutTimer = setTimeout(() => {
      const { pid } = proc;
      timedOut = true;
      if (pid === undefined) return;
      killTree(pid, false, platform);
      forceTimer = setTimeout(() => {
        killTree(pid, true, platform);
        if (!settled)
          slotTimer = setTimeout(() => {
            settle(null);
          }, graceMs);
      }, graceMs);
    }, timeoutMs);
  });
}
