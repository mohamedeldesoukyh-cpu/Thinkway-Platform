/**
 * Client-side refresh gate for the Platform Bulk Operations Framework.
 * While locked, workspace / router / KPI refreshes are queued as no-ops.
 * Exactly one refresh runs after the runner unlocks.
 */

let lockCount = 0;
const listeners = new Set<(locked: boolean) => void>();

function notify() {
  const locked = lockCount > 0;
  for (const listener of listeners) listener(locked);
}

/** Begin bulk execution — suppress mid-run refreshes. */
export function beginBulkRefreshLock(): void {
  lockCount += 1;
  notify();
}

/** End bulk execution — allow the single post-run refresh. */
export function endBulkRefreshLock(): void {
  lockCount = Math.max(0, lockCount - 1);
  notify();
}

export function isBulkRefreshLocked(): boolean {
  return lockCount > 0;
}

export function subscribeBulkRefreshLock(
  listener: (locked: boolean) => void
): () => void {
  listeners.add(listener);
  listener(lockCount > 0);
  return () => {
    listeners.delete(listener);
  };
}
