/**
 * Stats summary bar for runner dashboard.
 */

import type { RunnerStats } from '@/lib/runner-api';

interface StatsBarProps {
  stats: RunnerStats | null;
}

interface StatCardProps {
  label: string;
  value: number;
  color: string;
}

function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div className="flex flex-col items-center px-4 py-2">
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function StatsBar({ stats }: StatsBarProps) {
  if (!stats) {
    return (
      <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
        <span className="text-sm text-muted-foreground">Loading stats...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 bg-muted/50 rounded-lg">
      <StatCard label="Total" value={stats.totalJobs} color="text-foreground" />
      <StatCard label="Running" value={stats.running} color="text-yellow-600 dark:text-yellow-400" />
      <StatCard label="OK (1h)" value={stats.okLastHour} color="text-green-600 dark:text-green-400" />
      <StatCard label="Errors (1h)" value={stats.errorsLastHour} color="text-red-600 dark:text-red-400" />
    </div>
  );
}
