/**
 * API client for jeeves-runner proxy endpoints.
 * Unwraps runner API responses and maps snake_case to camelCase.
 */

import { withKey } from './api';

const RUNNER_BASE = '/api/runner';

async function runnerFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(withKey(`${RUNNER_BASE}${path}`), {
    ...init,
    credentials: 'same-origin',
  });

  if (res.status === 401) {
    window.location.href = `/auth/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Runner API error ${String(res.status)}: ${body}`);
  }

  return res.json() as Promise<T>;
}

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
  totalJobs: number;
  running: number;
  okLastHour: number;
  errorsLastHour: number;
}

// --- Public types (camelCase) ---

export interface RunnerStats {
  totalJobs: number;
  running: number;
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
  const raw = await runnerFetch<RawStats>('/stats');
  return raw;
}

export async function getRunnerJobs(): Promise<RunnerJob[]> {
  const raw = await runnerFetch<{ jobs: RawJob[] }>('/jobs');
  return raw.jobs.map(mapJob);
}

export async function getRunnerJob(id: string): Promise<RunnerJob> {
  const raw = await runnerFetch<{ job: RawJob }>(
    `/jobs/${encodeURIComponent(id)}`,
  );
  return mapJob(raw.job);
}

export async function getJobRuns(
  id: string,
  limit = 20,
): Promise<RunEntry[]> {
  const raw = await runnerFetch<{ runs: RawRun[] }>(
    `/jobs/${encodeURIComponent(id)}/runs?limit=${String(limit)}`,
  );
  return raw.runs.map(mapRun);
}

export async function triggerJobRun(id: string): Promise<{ ok: boolean }> {
  return runnerFetch<{ ok: boolean }>(
    `/jobs/${encodeURIComponent(id)}/run`,
    { method: 'POST' },
  );
}

export async function enableJob(id: string): Promise<{ ok: boolean }> {
  return runnerFetch<{ ok: boolean }>(
    `/jobs/${encodeURIComponent(id)}/enable`,
    { method: 'POST' },
  );
}

export async function disableJob(id: string): Promise<{ ok: boolean }> {
  return runnerFetch<{ ok: boolean }>(
    `/jobs/${encodeURIComponent(id)}/disable`,
    { method: 'POST' },
  );
}
