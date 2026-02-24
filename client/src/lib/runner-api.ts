/**
 * API client for jeeves-runner proxy endpoints.
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

export interface RunnerStats {
  totalJobs: number;
  enabledJobs: number;
  disabledJobs: number;
  runningJobs: number;
  okJobs: number;
  errorJobs: number;
}

export interface RunnerJob {
  id: string;
  name: string;
  type: string;
  schedule: string;
  enabled: boolean;
  overlapPolicy: string;
  status: string;
  lastRun: string | null;
  lastDuration: number | null;
  nextRun: string | null;
}

export interface RunEntry {
  id: string;
  jobId: string;
  status: string;
  trigger: string;
  startedAt: string;
  finishedAt: string | null;
  duration: number | null;
  exitCode: number | null;
  stdout_tail: string;
  stderr_tail: string;
}

export interface RunnerHealth {
  status: string;
  uptime: number;
  version: string;
}

export async function getRunnerHealth(): Promise<RunnerHealth> {
  return runnerFetch<RunnerHealth>('/health');
}

export async function getRunnerStats(): Promise<RunnerStats> {
  return runnerFetch<RunnerStats>('/stats');
}

export async function getRunnerJobs(): Promise<RunnerJob[]> {
  return runnerFetch<RunnerJob[]>('/jobs');
}

export async function getRunnerJob(id: string): Promise<RunnerJob> {
  return runnerFetch<RunnerJob>(`/jobs/${encodeURIComponent(id)}`);
}

export async function getJobRuns(
  id: string,
  limit = 20,
): Promise<RunEntry[]> {
  return runnerFetch<RunEntry[]>(
    `/jobs/${encodeURIComponent(id)}/runs?limit=${String(limit)}`,
  );
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
