/**
 * Runner job detail view — job info, enable/disable, run history.
 */

import { ArrowLeft, Play, Power, PowerOff } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Header } from '@/components/layout/Header';
import { RunHistory } from '@/components/runner/RunHistory';
import { StatusPill } from '@/components/runner/StatusPill';
import { Button } from '@/components/ui/button';
import { useAuthStatus } from '@/lib/AuthStatusContext';
import type { RunEntry, RunnerJob as RunnerJobType } from '@/lib/runner-api';
import {
  disableJob,
  enableJob,
  getJobRuns,
  getRunnerJob,
  triggerJobRun,
} from '@/lib/runner-api';
import { useTheme } from '@/lib/theme';
import { computeKeyAge } from '@/lib/utils';

export function RunnerJob() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<RunnerJobType | null>(null);
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, toggleTheme] = useTheme();
  const { isInsider, searchEnabled, keyCreatedAt, rotateKey } = useAuthStatus();

  const keyAge = useMemo(() => computeKeyAge(keyCreatedAt), [keyCreatedAt]);

  const fetchData = useCallback(async () => {
    if (!jobId) return;
    try {
      const [jobData, runsData] = await Promise.all([
        getRunnerJob(jobId),
        getJobRuns(jobId, 50),
      ]);
      setJob(jobData);
      setRuns(runsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch job');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    queueMicrotask(() => { void fetchData(); });
  }, [fetchData]);

  const handleToggleEnabled = useCallback(async () => {
    if (!job) return;
    try {
      if (job.enabled) await disableJob(job.id);
      else await enableJob(job.id);
      await fetchData();
    } catch {
      await fetchData();
    }
  }, [job, fetchData]);

  const handleRunNow = useCallback(async () => {
    if (!job) return;
    try {
      await triggerJobRun(job.id);
      setTimeout(() => void fetchData(), 500);
    } catch {
      await fetchData();
    }
  }, [job, fetchData]);

  const breadcrumbs = [
    { label: 'Runner', path: 'runner' },
    { label: job?.name ?? jobId ?? '', path: `runner/${jobId}` },
  ];

  return (
    <div className={`h-screen overflow-hidden ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="h-full flex flex-col bg-background text-foreground">
        {/* Shared header */}
        <Header
          breadcrumbs={breadcrumbs}
          isInsider={isInsider}
          searchEnabled={searchEnabled}
          theme={theme}
          onToggleTheme={toggleTheme}
          keyAge={keyAge}
          onRotateKey={rotateKey}
        />

        <div className="flex-1 overflow-y-auto max-w-4xl mx-auto px-4 py-6 pb-32 space-y-6 w-full">
          <Link
            to="/runner"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to jobs
          </Link>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : job ? (
            <>
              {/* Job Info Card */}
              <div className="bg-card border border-border rounded-lg p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-xl font-semibold">{job.name}</h1>
                    <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                      <span>Type: <span className="text-foreground">{job.type}</span></span>
                      <span>Schedule: <code className="text-xs bg-muted px-1 py-0.5 rounded">{job.schedule}</code></span>
                      <span>Overlap: <span className="text-foreground">{job.overlapPolicy}</span></span>
                    </div>
                  </div>
                  <StatusPill status={job.enabled ? job.status : 'disabled'} />
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleToggleEnabled()}
                    className="gap-1.5"
                  >
                    {job.enabled
                      ? <><PowerOff className="h-3.5 w-3.5" /> Disable</>
                      : <><Power className="h-3.5 w-3.5" /> Enable</>
                    }
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleRunNow()}
                    className="gap-1.5"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Run Now
                  </Button>
                </div>
              </div>

              {/* Run History */}
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h2 className="text-sm font-medium text-muted-foreground">Run History</h2>
                </div>
                <RunHistory runs={runs} />
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">Job not found</div>
          )}
        </div>
      </div>
    </div>
  );
}
