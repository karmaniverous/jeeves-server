/**
 * The runner page's API: jeeves-runner's own API through the server's
 * runner proxy entries (`runnerListJobs`, `runnerGetJob`, `runnerListRuns`,
 * `runnerRunJob`, `runnerEnableJob`, `runnerDisableJob`, `runnerStatus`;
 * Decision 28) on the SPA's SDK client. Unwraps runner responses and maps
 * snake_case to camelCase.
 */

import { server } from './server';

// --- Raw runner API shapes (snake_case) ---

interface RawJob {
  id: string;
  name: string;
  type: string;
  schedule: string;
  enabled: number;
  overlap_policy: string;
  last_status: string | null;
  last_run: string | null;
  description: string | null;
}

interface RawRun {
  id: number;
  job_id: string;
  status: string;
  trigger: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  exit_code: number | null;
  stdout_tail: string;
  stderr_tail: string;
}

interface RawStats {
  status: string;
  version: string;
  uptime: number;
  totalJobs: number;
  running: number;
  failedRegistrations: number;
  okLastHour: number;
  errorsLastHour: number;
}

// --- Public types (camelCase) ---

export interface RunnerStats {
  status: string;
  version: string;
  uptime: number;
  totalJobs: number;
  running: number;
  failedRegistrations: number;
  okLastHour: number;
  errorsLastHour: number;
}

export interface RunnerJob {
  id: string;
  name: string;
  type: string;
  schedule: string;
  enabled: boolean;
  overlapPolicy: string;
  status: string | null;
  lastRun: string | null;
  description: string | null;
}

export interface RunEntry {
  id: number;
  jobId: string;
  status: string;
  trigger: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  exitCode: number | null;
  stdoutTail: string;
  stderrTail: string;
}

function mapJob(raw: RawJob): RunnerJob {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    schedule: raw.schedule,
    enabled: raw.enabled === 1,
    overlapPolicy: raw.overlap_policy,
    status: raw.last_status,
    lastRun: raw.last_run,
    description: raw.description,
  };
}

function mapRun(raw: RawRun): RunEntry {
  return {
    id: raw.id,
    jobId: raw.job_id,
    status: raw.status,
    trigger: raw.trigger,
    startedAt: raw.started_at,
    finishedAt: raw.finished_at,
    durationMs: raw.duration_ms,
    exitCode: raw.exit_code,
    stdoutTail: raw.stdout_tail,
    stderrTail: raw.stderr_tail,
  };
}

export async function getRunnerStats(): Promise<RunnerStats> {
  return (await server.runnerStatus()) as RawStats;
}

export async function getRunnerJobs(): Promise<RunnerJob[]> {
  const raw = (await server.runnerListJobs()) as { jobs: RawJob[] };
  return raw.jobs.map(mapJob);
}

export async function getRunnerJob(id: string): Promise<RunnerJob> {
  const raw = (await server.runnerGetJob({ id })) as { job: RawJob };
  return mapJob(raw.job);
}

export async function getJobRuns(id: string, limit = 20): Promise<RunEntry[]> {
  const raw = (await server.runnerListRuns({
    id,
    limit: String(limit),
  })) as { runs: RawRun[] };
  return raw.runs.map(mapRun);
}

export async function triggerJobRun(id: string): Promise<{ ok: boolean }> {
  return (await server.runnerRunJob({ id })) as { ok: boolean };
}

export async function enableJob(id: string): Promise<{ ok: boolean }> {
  return (await server.runnerEnableJob({ id })) as { ok: boolean };
}

export async function disableJob(id: string): Promise<{ ok: boolean }> {
  return (await server.runnerDisableJob({ id })) as { ok: boolean };
}
