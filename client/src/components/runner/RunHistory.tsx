/**
 * Run history table with expandable stdout/stderr for job detail view.
 */

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import type { RunEntry } from '@/lib/runner-api';

import { StatusPill } from './StatusPill';

interface RunHistoryProps {
  runs: RunEntry[];
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

export function RunHistory({ runs }: RunHistoryProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (runs.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        No runs yet
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-3 py-2 w-8" />
            <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Trigger</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Started</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Duration</th>
            <th className="px-3 py-2 font-medium text-muted-foreground">Exit</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <RunRow
              key={run.id}
              run={run}
              isExpanded={expanded.has(run.id)}
              onToggle={() => toggle(run.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface RunRowProps {
  run: RunEntry;
  isExpanded: boolean;
  onToggle: () => void;
}

function RunRow({ run, isExpanded, onToggle }: RunRowProps) {
  const hasOutput = run.stdout_tail || run.stderr_tail;

  return (
    <>
      <tr
        className={`border-b border-border transition-colors ${hasOutput ? 'cursor-pointer hover:bg-muted/50' : ''}`}
        onClick={hasOutput ? onToggle : undefined}
      >
        <td className="px-3 py-2">
          {hasOutput && (
            isExpanded
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </td>
        <td className="px-3 py-2"><StatusPill status={run.status} /></td>
        <td className="px-3 py-2 text-muted-foreground">{run.trigger}</td>
        <td className="px-3 py-2 text-muted-foreground text-xs">
          {formatTime(run.startedAt)}
        </td>
        <td className="px-3 py-2 text-muted-foreground text-xs">
          {formatDuration(run.duration)}
        </td>
        <td className="px-3 py-2 font-mono text-xs">
          {run.exitCode !== null ? String(run.exitCode) : '—'}
        </td>
      </tr>
      {isExpanded && hasOutput && (
        <tr>
          <td colSpan={6} className="px-3 py-2 bg-muted/30">
            <OutputBlock label="stdout" content={run.stdout_tail} />
            <OutputBlock label="stderr" content={run.stderr_tail} />
          </td>
        </tr>
      )}
    </>
  );
}

function OutputBlock({ label, content }: { label: string; content: string }) {
  if (!content) return null;
  return (
    <div className="mb-2 last:mb-0">
      <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
      <pre className="text-xs bg-zinc-900 text-zinc-200 p-2 rounded overflow-x-auto max-h-48 whitespace-pre-wrap">
        {content}
      </pre>
    </div>
  );
}
