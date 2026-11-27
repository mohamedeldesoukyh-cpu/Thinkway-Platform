/** Retain the explicit client amounts while billing a line for free. */
export type FreeClientPrice = { free_for_client: boolean; client_price_before_free: { revenue: number; usage: number } | null };
export function readFreeClientPrice(metadata: unknown): FreeClientPrice {
  const m = metadata && typeof metadata === "object" ? metadata as Record<string, unknown> : {};
  const b = m.client_price_before_free as { revenue?: unknown; usage?: unknown } | null;
  const valid = b && typeof b.revenue === "number" && Number.isFinite(b.revenue) && b.revenue >= 0 && typeof b.usage === "number" && Number.isFinite(b.usage) && b.usage >= 0;
  return { free_for_client: m.free_for_client === true && Boolean(valid), client_price_before_free: valid ? { revenue: b.revenue as number, usage: b.usage as number } : null };
}
export function toggleFreeClientPrice(state: FreeClientPrice, revenue: number, usage: number, free: boolean) {
  if (free) return { free_for_client: true, client_price_before_free: state.free_for_client ? state.client_price_before_free : { revenue, usage }, revenue: 0, usage: 0 };
  return { free_for_client: false, client_price_before_free: null, revenue: state.free_for_client ? state.client_price_before_free?.revenue ?? revenue : revenue, usage: state.free_for_client ? state.client_price_before_free?.usage ?? usage : usage };
}
