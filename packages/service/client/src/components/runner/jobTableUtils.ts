/**
 * Sorting utilities for the runner job table.
 */
import type { RunnerJob } from '@/lib/runner-api';

import type { SortColumn, SortState } from './JobTable';

/**
 * Sort jobs by chosen column, then by lastRun desc, then by name asc.
 * Null lastRun values sort to the end.
 */
export function sortJobs(jobs: RunnerJob[], sort: SortState): RunnerJob[] {
  return [...jobs].sort((a, b) => {
    // Primary: chosen sort column
    if (sort.column) {
      const cmp = compareByColumn(a, b, sort.column);
      if (cmp !== 0) return sort.direction === 'asc' ? cmp : -cmp;
    }

    // Secondary: lastRun desc (nulls last)
    const lastRunCmp = compareNullableDate(a.lastRun, b.lastRun);
    if (lastRunCmp !== 0) return -lastRunCmp; // negative for desc

    // Tertiary: name asc
    return a.name.localeCompare(b.name);
  });
}

function compareByColumn(a: RunnerJob, b: RunnerJob, col: SortColumn): number {
  switch (col) {
    case 'name':
      return a.name.localeCompare(b.name);
    case 'type':
      return a.type.localeCompare(b.type);
    case 'schedule':
      return a.schedule.localeCompare(b.schedule);
    case 'status': {
      const sa = a.enabled ? (a.status ?? '') : 'disabled';
      const sb = b.enabled ? (b.status ?? '') : 'disabled';
      return sa.localeCompare(sb);
    }
    case 'lastRun':
      return compareNullableDate(a.lastRun, b.lastRun);
    default:
      return 0;
  }
}

function compareNullableDate(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return -1; // nulls last
  if (!b) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Cycle sort: click same column toggles asc↔desc; click different column starts desc. */
export function nextSort(current: SortState, column: SortColumn): SortState {
  if (current.column === column) {
    // Same column: asc → desc → clear
    if (current.direction === 'desc') return { column, direction: 'asc' };
    return { column: null, direction: 'desc' }; // clear
  }
  // New column: start desc
  return { column, direction: 'desc' };
}
