/**
 * Runner dashboard — job list view with stats summary and auto-refresh.
 */

import { Activity, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { JobTable } from '@/components/runner/JobTable';
import { StatsBar } from '@/components/runner/StatsBar';
import { Button } from '@/components/ui/button';
import type { RunnerJob, RunnerStats } from '@/lib/runner-api';
import { getRunnerJobs, getRunnerStats, triggerJobRun } from '@/lib/runner-api';
import { useTheme } from '@/lib/theme';

const REFRESH_INTERVAL = 10_000;

export function Runner() {
  const [jobs, setJobs] = useState<RunnerJob[]>([]);
  const [stats, setStats] = useState<RunnerStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [theme] = useTheme();

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
    void fetchData();
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
      // Refresh anyway to show current state
      await fetchData();
    }
  }, [fetchData]);

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="min-h-screen bg-background text-foreground">
        {/* Header */}
        <header className="bg-zinc-800 text-white px-4 py-2">
          <div className="flex items-center gap-2">
            <Link to="/browse" className="text-3xl no-underline shrink-0" title="Jeeves Server">
              🎩
            </Link>
            <span className="text-zinc-500 mx-0.5">/</span>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-zinc-400" />
              <span className="text-zinc-300 font-medium">Runner</span>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
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
                className="text-zinc-300 hover:text-white hover:bg-white/10 h-8 w-8"
                title="Refresh now"
                onClick={() => void fetchData()}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : (
            <>
              <StatsBar stats={stats} />
              <div className="bg-card border border-border rounded-lg">
                <JobTable jobs={jobs} onRunNow={(id) => void handleRunNow(id)} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
