/**
 * Colored status pill for runner job status display.
 */

const statusStyles: Record<string, string> = {
  ok: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  running: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  disabled: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  pending: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

const fallbackStyle = 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300';

interface StatusPillProps {
  status: string | null;
}

export function StatusPill({ status }: StatusPillProps) {
  const display = status ?? 'pending';
  const style = statusStyles[display] ?? fallbackStyle;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {display}
    </span>
  );
}
