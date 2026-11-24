// Keep pending additions alive when a detail dialog closes or changes creator.
const queues = new Map<string, Promise<unknown>>();
export function queuePlatformAddition<T>(creatorId: string, work: () => Promise<T>): Promise<T> {
  // Internal creator callers may supply either the UUID or its unified ID.
  const key = creatorId.startsWith("inf:") ? creatorId.slice(4) : creatorId;
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(work);
  queues.set(key, next);
  void next.finally(() => {
    if (queues.get(key) === next) queues.delete(key);
  }).catch(() => undefined);
  return next;
}

/** An old background job must never mutate a newly opened dialog. */
export function createPlatformDialogSession() {
  let current: object | null = null;
  return {
    open() { current = {}; },
    close() { current = null; },
    capture() {
      const submittedIn = current;
      return () => submittedIn !== null && current === submittedIn;
    },
  };
}

export function splitPlatformLinks(value: string): string[] {
  return [...new Set(value.split(/[\s,;]+/).map(link => link.trim()).filter(Boolean))];
}
