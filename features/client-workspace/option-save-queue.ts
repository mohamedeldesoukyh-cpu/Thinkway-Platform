/** Serialize review writes (the server uses an updated_at concurrency guard).
 * Coalesce queued edits for one creator without dropping the latest choice. */
export function createOptionSaveQueue() {
  const revisions = new Map<string, number>();
  let tail: Promise<void> = Promise.resolve();
  return {
    enqueue(key: string, save: (isLatest: () => boolean) => Promise<void>): Promise<void> {
      const revision = (revisions.get(key) ?? 0) + 1;
      revisions.set(key, revision);
      const isLatest = () => revisions.get(key) === revision;
      const task = tail.then(async () => { if (isLatest()) await save(isLatest); });
      tail = task.catch(() => { /* A failed save must not block subsequent choices. */ });
      return task;
    },
  };
}
