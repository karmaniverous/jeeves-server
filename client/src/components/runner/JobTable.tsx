/**
 * Job list table for runner dashboard.
 */

import { Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import type { RunnerJob } from '@/lib/runner-api';

import { StatusPill } from './StatusPill';

interface JobTableProps {
  jobs: RunnerJob[];
  onRunNow: (id: string) => void;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${String(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${String(m)}m ${String(rem)}s`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function JobTable({ jobs, onRunNow }: JobTableProps) {
  const navigate = useNavigate();

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No jobs found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-3 py-2 font-medium text-muted-foreground">Name</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Type</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Schedule</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Last Run</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Duration</th>
            <th className="px-3 py-2 font-medium text-muted-foreground" />
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr
              key={job.id}
              className="border-b border-border hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => navigate(`/runner/${job.id}`)}
            >
              <td className="px-3 py-2 font-medium">{job.name}</td>
              <td className="px-3 py-2 text-muted-foreground">{job.type}</td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {job.schedule}
              </td>
              <td className="px-3 py-2">
                <StatusPill status={job.enabled ? job.status : 'disabled'} />
              </td>
              <td className="px-3 py-2 text-muted-foreground text-xs">
                {formatTime(job.lastRun)}
              </td>
              <td className="px-3 py-2 text-muted-foreground text-xs">
                {formatDuration(job.lastDuration)}
              </td>
              <td className="px-3 py-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Run Now"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRunNow(job.id);
                  }}
                >
                  <Play className="h-3.5 w-3.5" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
