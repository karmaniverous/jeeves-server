/**
 * Per-file mutex to prevent concurrent write races.
 * Each entry holds a promise chain; new operations append to the chain.
 */

const fileLocks = new Map<string, Promise<void>>();

/** Serialize async work per file path to prevent lost-update races. */
export function withFileLock<T>(
  filePath: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = fileLocks.get(filePath) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  // Store the void chain (swallow the result so the map stays Promise<void>)
  fileLocks.set(
    filePath,
    next.then(
      () => {},
      () => {},
    ),
  );
  return next;
}
