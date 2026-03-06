/**
 * Formatting utilities for dates, file sizes, etc.
 */

/**
 * Format file size in human-readable format
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  const decimals = i > 0 ? 1 : 0;
  return `${value.toFixed(decimals)} ${units[i]}`;
}

/**
 * Format ISO timestamp as relative time (e.g., "2h ago")
 */
export function formatRelativeTime(isoTimestamp: string | null): string | null {
  if (!isoTimestamp) return null;

  const then = new Date(isoTimestamp).getTime();
  const now = Date.now();
  const diffMs = now - then;

  if (diffMs < 0) return null;

  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${String(days)}d ago`;
  if (hours > 0) return `${String(hours)}h ago`;
  if (mins > 0) return `${String(mins)}m ago`;
  return 'just now';
}

/**
 * Get current ISO timestamp
 */
export function nowIso(): string {
  return new Date().toISOString();
}
