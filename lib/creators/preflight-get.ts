/** GET-only JSON transport. Never logs URLs, headers, credentials or response bodies. */
export type ReadProgress = { event: string; [key: string]: string | number | boolean };
export type ReadOptions = {
  progress?: (event: ReadProgress) => void;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
  timeoutMs?: number;
};

export async function getPreflightJson(
  transport: typeof fetch, url: string, headers: Record<string, string>,
  options: ReadOptions = {},
): Promise<{ data: unknown; headers: Headers }> {
  const retries = options.maxRetries ?? 4;
  const timeoutMs = options.timeoutMs ?? 60_000;
  if (!Number.isInteger(retries) || retries < 0 || retries > 6 ||
      !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) {
    throw new Error("Invalid bounded read options");
  }
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const service = new URL(url).hostname === "api.apify.com" ? "apify" : "supabase";
  for (let attempt = 0; ; attempt++) {
    let status = 0;
    let retryAfter = 0;
    options.progress?.({ event: "request", service, attempt: attempt + 1 });
    try {
      const response = await transport(url, { method: "GET", headers, redirect: "error", signal: AbortSignal.timeout(timeoutMs) });
      status = response.status;
      if (response.ok) return { data: await response.json(), headers: response.headers };
      const hint = response.headers.get("retry-after");
      if (hint) retryAfter = /^\d+(\.\d+)?$/.test(hint) ? Number(hint) * 1000 : Math.max(0, Date.parse(hint) - Date.now());
      await response.body?.cancel();
    } catch {
      // Also retry bounded network/time-out/truncated JSON failures. Never expose
      // transport error text: it can contain a URL or authentication material.
    }
    if (status && status !== 429 && (status < 500 || status > 599) && (status < 200 || status > 299)) {
      throw new Error(`Authenticated storage read failed (${status})`);
    }
    if (attempt >= retries || retryAfter > 30_000) {
      throw new Error(`Storage GET exhausted (${service}, status ${status || "network"}, attempts ${attempt + 1})`);
    }
    const delayMs = Math.min(30_000, Math.max(1000 * 2 ** attempt, retryAfter || 0));
    options.progress?.({ event: "retry", service, status, attempt: attempt + 1, delayMs });
    await sleep(delayMs);
  }
}
