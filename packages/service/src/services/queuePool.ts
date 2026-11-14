/**
 * A bounded task pool: at most `concurrency` tasks in flight; the next starts as soon as any settles (`Promise.race` over the in-flight set, #285).
 *
 * @packageDocumentation
 */

/**
 * Run `task` over `items` with at most `concurrency` in flight, and wait
 * for every one to settle. A rejected task doesn't stop the others.
 *
 * @param items - The work items, started in order.
 * @param concurrency - Most tasks in flight (at least 1).
 * @param task - The task.
 */
export async function runPool<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<unknown>,
): Promise<void> {
  const limit = Math.max(1, Math.floor(concurrency));
  const inFlight = new Set<Promise<void>>();
  for (const item of items) {
    while (inFlight.size >= limit) await Promise.race(inFlight);
    const settled: Promise<void> = task(item).then(
      () => {
        inFlight.delete(settled);
      },
      () => {
        inFlight.delete(settled);
      },
    );
    inFlight.add(settled);
  }
  await Promise.all(inFlight);
}
