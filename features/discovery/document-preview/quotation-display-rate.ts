export type QuotationDisplayRate = { currency: string; asOf: string | null; rate: number };

/** Share short-lived rates and in-flight requests within this page session. */
export function createQuotationRateLoader(fetchRate: typeof fetch = fetch, now = Date.now) {
  const cached = new Map<string, { value: QuotationDisplayRate; expires: number }>();
  const pending = new Map<string, Promise<QuotationDisplayRate>>();
  return function load(currency: string, asOf?: string | null): Promise<QuotationDisplayRate> {
    const code = currency.toUpperCase();
    const date = asOf?.slice(0, 10) || null;
    if (code === "EGP") return Promise.resolve({ currency: code, asOf: date, rate: 1 });
    const key = `${code}:${date ?? "current"}`;
    const hit = cached.get(key);
    if (hit && hit.expires > now()) return Promise.resolve(hit.value);
    const running = pending.get(key);
    if (running) return running;
    const query = new URLSearchParams({ currency: code });
    if (date) query.set("asOf", date);
    const request = (async () => {
      const response = await fetchRate(`/api/quotations/exchange-rate?${query}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
      const result = await response.json();
      if (!response.ok || result.currency !== code || result.asOf !== date || !Number.isFinite(result.rate) || result.rate <= 0) {
        throw new Error(result.error || `Could not load the ${code} exchange rate.`);
      }
      const value: QuotationDisplayRate = { currency: code, asOf: date, rate: result.rate };
      cached.set(key, { value, expires: now() + 60000 });
      return value;
    })();
    pending.set(key, request);
    void request.finally(() => pending.delete(key)).catch(() => {});
    return request;
  };
}

export const loadQuotationDisplayRate = createQuotationRateLoader();
