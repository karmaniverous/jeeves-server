/**
 * Job list table for runner dashboard.
 * Split into header and body so the header can be pinned outside the scroll area.
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

/** Shared column widths so header and body stay aligned. */
const colClass = {
  name: 'w-[30%] px-3 py-2',
  type: 'w-[10%] px-3 py-2',
  schedule: 'w-[15%] px-3 py-2',
  status: 'w-[12%] px-3 py-2',
  lastRun: 'w-[25%] px-3 py-2',
  action: 'w-[8%] px-3 py-2',
};

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function JobTableHeader() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className={`${colClass.name} font-medium text-muted-foreground`}>Name</th>
            <th className={`${colClass.type} font-medium text-muted-foreground`}>Type</th>
            <th className={`${colClass.schedule} font-medium text-muted-foreground`}>Schedule</th>
            <th className={`${colClass.status} font-medium text-muted-foreground`}>Status</th>
            <th className={`${colClass.lastRun} font-medium text-muted-foreground`}>Last Run</th>
            <th className={`${colClass.action} font-medium text-muted-foreground`} />
          </tr>
        </thead>
      </table>
    </div>
  );
}

export function JobTableBody({ jobs, onRunNow }: JobTableProps) {
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
        <tbody>
          {jobs.map((job) => (
            <tr
              key={job.id}
              className="border-b border-border hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => navigate(`/runner/${job.id}`)}
            >
              <td className={`${colClass.name} font-medium`}>{job.name}</td>
              <td className={`${colClass.type} text-muted-foreground`}>{job.type}</td>
              <td className={`${colClass.schedule} font-mono text-xs text-muted-foreground`}>
                {job.schedule}
              </td>
              <td className={colClass.status}>
                <StatusPill status={job.enabled ? job.status : 'disabled'} />
              </td>
              <td className={`${colClass.lastRun} text-muted-foreground text-xs`}>
                {formatTime(job.lastRun)}
              </td>
              <td className={colClass.action}>
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

/** Legacy combined export for backward compatibility. */
export function JobTable({ jobs, onRunNow }: JobTableProps) {
  return (
    <>
      <JobTableHeader />
      <JobTableBody jobs={jobs} onRunNow={onRunNow} />
    </>
  );
}
