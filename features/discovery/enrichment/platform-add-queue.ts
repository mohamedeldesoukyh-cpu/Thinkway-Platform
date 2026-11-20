// Keep pending additions alive when a detail dialog closes or changes creator.
const queues = new Map<string, Promise<unknown>>();
export function queuePlatformAddition<T>(creatorId: string, work: () => Promise<T>): Promise<T> {
  const previous = queues.get(creatorId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(work);
  queues.set(creatorId, next);
  void next.finally(() => {
    if (queues.get(creatorId) === next) queues.delete(creatorId);
  }).catch(() => undefined);
  return next;
}

export function splitPlatformLinks(value: string): string[] {
  return [...new Set(value.split(/[\s,;]+/).map(link => link.trim()).filter(Boolean))];
}
