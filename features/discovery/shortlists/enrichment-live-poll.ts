/** One request at a time; cancellation also ignores responses arriving after navigation. */
export function watchShortlistEnrichment<T>(options: {
  fetch: () => Promise<T>;
  onData: (data: T) => void;
  onError: (failed: boolean) => void;
  intervalMs?: number;
}) {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;
  async function tick() {
    try {
      const data = await options.fetch();
      if (cancelled) return;
      failures = 0;
      options.onError(false);
      options.onData(data);
    } catch {
      if (cancelled) return;
      failures += 1;
      options.onError(true);
    }
    if (!cancelled) {
      timer = setTimeout(tick, Math.min(30_000, (options.intervalMs ?? 3000) * (failures + 1)));
    }
  }
  void tick();
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}
