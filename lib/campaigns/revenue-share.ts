import { roundMoney } from "@/lib/analytics/aggregations/round";

/** Stored on campaign_headers.metadata; a fixed amount keeps its entry currency. */
export type RevenueShare = { mode: "amount" | "percent"; value: number; currency: string };

export function readRevenueShare(metadata: Record<string, unknown> | null | undefined): RevenueShare | null {
  const raw = metadata?.revenue_share as Partial<RevenueShare> | undefined;
  if (!raw) return null;
  if ((raw.mode !== "amount" && raw.mode !== "percent") || typeof raw.value !== "number" ||
      !Number.isFinite(raw.value) || raw.value < 0 || !/^[A-Z]{3}$/.test(raw.currency ?? "")) {
    throw new Error("Invalid saved campaign revenue share.");
  }
  return raw as RevenueShare;
}

export function revenueShareAmount(share: RevenueShare | null, revenue: number, currency: string,
  rates: ReadonlyMap<string, number>): number {
  if (!share || share.value === 0) return 0;
  if (share.mode === "percent") return roundMoney(Math.max(0, revenue) * share.value / 100);
  if (share.currency === currency) return roundMoney(share.value);
  const from = rates.get(share.currency);
  const to = rates.get(currency);
  if (!from || !to) throw new Error(`Missing FX rate for revenue share (${share.currency} to ${currency}).`);
  return roundMoney(share.value * from / to);
}

/** Allocate cents cumulatively, so a fully live campaign deducts exactly its saved total. */
export function allocateRevenueShare(amount: number, fullRevenue: number, portions: number[]): number[] {
  let cumulative = 0;
  let allocated = 0;
  return portions.map(revenue => {
    cumulative += Math.max(0, revenue);
    const target = fullRevenue > 0 ? roundMoney(amount * Math.min(cumulative / fullRevenue, 1)) : 0;
    const result = roundMoney(target - allocated);
    allocated = target;
    return result;
  });
}
