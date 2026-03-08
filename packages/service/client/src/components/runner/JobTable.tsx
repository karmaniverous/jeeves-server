/**
 * Job list table for runner dashboard.
 * Split into header and body so the header can be pinned outside the scroll area.
 * Supports column sorting with tri-state cycle: asc → desc → clear.
 */

import { ArrowDown, ArrowUp, ArrowUpDown, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import type { RunnerJob } from '@/lib/runner-api';

import { StatusPill } from './StatusPill';

/** Sortable column keys. */
export type SortColumn = 'name' | 'type' | 'schedule' | 'status' | 'lastRun';
export type SortDirection = 'asc' | 'desc';
export interface SortState {
  column: SortColumn | null;
  direction: SortDirection;
}

interface JobTableHeaderProps {
  sort: SortState;
  onSort: (column: SortColumn) => void;
}

interface JobTableBodyProps {
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

function SortIcon({ column, sort }: { column: SortColumn; sort: SortState }) {
  if (sort.column !== column) {
    return <ArrowUpDown className="h-3 w-3 opacity-40" />;
  }
  return sort.direction === 'asc'
    ? <ArrowUp className="h-3 w-3" />
    : <ArrowDown className="h-3 w-3" />;
}

interface ColumnDef {
  key: SortColumn;
  label: string;
}

const columns: ColumnDef[] = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'status', label: 'Status' },
  { key: 'lastRun', label: 'Last Run' },
];

export function JobTableHeader({ sort, onSort }: JobTableHeaderProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`${colClass[col.key]} font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors`}
                onClick={() => onSort(col.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  <SortIcon column={col.key} sort={sort} />
                </span>
              </th>
            ))}
            <th className={`${colClass.action} font-medium text-muted-foreground`} />
          </tr>
        </thead>
      </table>
    </div>
  );
}

export function JobTableBody({ jobs, onRunNow }: JobTableBodyProps) {
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

