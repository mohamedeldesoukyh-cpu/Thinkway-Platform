import { roundMoney } from "@/lib/analytics/aggregations/round";

/** Vendor rebate (VR%) on ex-VAT cost — added to COGS and deducted from GP. */
export function computeVrRefund(
  baseCost: number,
  vrRatePercent: number | null | undefined
): number {
  const rate = Math.max(0, Number(vrRatePercent ?? 0));
  if (rate === 0) return 0;
  return roundMoney(Math.max(0, baseCost) * (rate / 100));
}

export function computeGpAfterVr(gp: number, vrRefund: number): number {
  return roundMoney(gp - vrRefund);
}

export function applyVrRefundToLineCommercial(input: {
  baseCost: number;
  gp: number;
  vrRatePercent: number | null | undefined;
}): {
  base_cost: number;
  cost: number;
  gp: number;
  vr_refund: number;
  gp_after_vr: number;
} {
  const base_cost = roundMoney(input.baseCost);
  const vr_refund = computeVrRefund(base_cost, input.vrRatePercent);
  const gp = roundMoney(input.gp);
  return {
    base_cost,
    cost: roundMoney(base_cost + vr_refund),
    gp,
    vr_refund,
    gp_after_vr: computeGpAfterVr(gp, vr_refund),
  };
}

type VrRateJoin = { rate_percent: number } | { rate_percent: number }[] | null | undefined;

function extractVrRatePercent(rate: VrRateJoin): number | null {
  if (!rate) return null;
  const row = Array.isArray(rate) ? rate[0] : rate;
  if (!row) return null;
  const value = Number(row.rate_percent);
  return Number.isFinite(value) ? value : null;
}

/** Prefer live brand VR%; fall back to campaign header snapshot when brand is unset. */
export function resolveCampaignVrRatePercent(input: {
  headerVrRate?: VrRateJoin;
  brandVrRate?: VrRateJoin;
}): number {
  const brandRate = extractVrRatePercent(input.brandVrRate);
  if (brandRate != null) return brandRate;
  return extractVrRatePercent(input.headerVrRate) ?? 0;
}
