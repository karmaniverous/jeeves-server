/**
 * Runner dashboard — job list view with stats summary and auto-refresh.
 */

import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Header } from '@/components/layout/Header';
import { JobTableBody, JobTableHeader,  } from '@/components/runner/JobTable';
import { nextSort, sortJobs } from '@/components/runner/jobTableUtils';
import type { SortColumn, SortState } from '@/components/runner/JobTable';
import { StatsBar } from '@/components/runner/StatsBar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import type { RunnerJob, RunnerStats } from '@/lib/runner-api';
import { getRunnerJobs, getRunnerStats, triggerJobRun } from '@/lib/runner-api';
import { useTheme } from '@/lib/theme';

const REFRESH_INTERVAL = 10_000;

/** Compute key age in days from a creation timestamp. */
function computeKeyAge(keyCreatedAt: string | null | undefined): string | null {
  if (!keyCreatedAt) return null;
  return `${Math.floor((Date.now() - new Date(keyCreatedAt).getTime()) / 86_400_000)}d`;
}

export function Runner() {
  const [jobs, setJobs] = useState<RunnerJob[]>([]);
  const [stats, setStats] = useState<RunnerStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [sort, setSort] = useState<SortState>({ column: null, direction: 'desc' });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [theme, toggleTheme] = useTheme();
  const { isInsider, searchEnabled, keyCreatedAt, rotateKey } = useAuth();

  // Compute key age string (in effect to avoid impure Date.now during render)
  const [keyAge, setKeyAge] = useState<string | null>(null);
  useEffect(() => {
    queueMicrotask(() => { setKeyAge(computeKeyAge(keyCreatedAt)); });
  }, [keyCreatedAt]);

  const fetchData = useCallback(async () => {
    try {
      const [jobsData, statsData] = await Promise.all([
        getRunnerJobs(),
        getRunnerStats(),
      ]);
      setJobs(jobsData);
      setStats(statsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch runner data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void fetchData(); });
  }, [fetchData]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => void fetchData(), REFRESH_INTERVAL);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchData]);

  const handleRunNow = useCallback(async (id: string) => {
    try {
      await triggerJobRun(id);
      await fetchData();
    } catch {
      await fetchData();
    }
  }, [fetchData]);

  const handleSort = useCallback((column: SortColumn) => {
    setSort((prev) => nextSort(prev, column));
  }, []);

  const sortedJobs = useMemo(() => sortJobs(jobs, sort), [jobs, sort]);

  const breadcrumbs = [{ label: 'Runner', path: 'runner' }];

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

        {/* Runner controls bar */}
        <div className="shrink-0 max-w-6xl mx-auto w-full px-4 pt-2 pb-1 flex items-center justify-between">
          {!loading && <StatsBar stats={stats} />}
          <div className="flex items-center gap-2 shrink-0">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              Auto-refresh
            </label>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Refresh now"
              onClick={() => void fetchData()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="shrink-0 max-w-6xl mx-auto w-full px-4 pt-2">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading...</div>
        ) : (
          /* Single card: header pinned, body scrolls, scrollbar inside card */
          <div className="flex-1 min-h-0 max-w-6xl mx-auto w-full px-4 pt-1 flex flex-col">
            <div className="flex-1 min-h-0 bg-card border border-border rounded-lg flex flex-col">
              {/* Pinned table header */}
              <div className="shrink-0">
                <JobTableHeader sort={sort} onSort={handleSort} />
              </div>
              {/* Scrollable table body — padding inside the scroll for mobile bottom space */}
              <div className="flex-1 overflow-y-auto pb-32">
                <JobTableBody jobs={sortedJobs} onRunNow={(id) => void handleRunNow(id)} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
