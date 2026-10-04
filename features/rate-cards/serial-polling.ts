/** Schedule only after the previous request finishes; never build an action backlog. */
export function startSerialPolling(task: (active: () => boolean) => Promise<void>, enabled: boolean, delay = 5000) {
  let live = enabled;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = async () => {
    if (!live) return;
    try { await task(() => live); }
    finally { if (live) timer = setTimeout(() => void run(), delay); }
  };
  if (live) void run();
  return () => { live = false; if (timer !== undefined) clearTimeout(timer); };
}
