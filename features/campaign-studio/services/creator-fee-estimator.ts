import { resolveCreatorTierLabel } from "@/lib/creators/creator-tier";

/**
 * MENA market post-fee benchmarks (calibrated from Thinkway rate cards / Zahran & agency lists).
 * Values are approximate single-post fees before VAT.
 */
const EGP_POST_BENCHMARKS: Record<string, { min: number; max: number }> = {
  nano: { min: 3_000, max: 8_000 },
  micro: { min: 8_000, max: 35_000 },
  mid: { min: 35_000, max: 120_000 },
  macro: { min: 120_000, max: 250_000 },
  mega: { min: 250_000, max: 600_000 },
  celebrity: { min: 600_000, max: 1_500_000 },
};

const PLATFORM_MULTIPLIER: Record<string, number> = {
  instagram: 1,
  tiktok: 0.88,
  youtube: 1.25,
};

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
}

function egpToCurrency(egp: number, currency: string): number {
  const rates: Record<string, number> = {
    EGP: 1,
    USD: 1 / 48,
    AED: 1 / 13,
    SAR: 1 / 12.8,
    EUR: 1 / 52,
  };
  const rate = rates[currency.toUpperCase()] ?? rates.USD;
  return egp * rate;
}

const TIER_BENCHMARK_KEY: Record<string, keyof typeof EGP_POST_BENCHMARKS> = {
  nano: "nano",
  micro: "micro",
  "mid-tier": "mid",
  mid: "mid",
  macro: "macro",
  celebrity: "celebrity",
  unknown: "mid",
};

/** Estimate single-post fee from followers, tier, platform, and optional commercial references. */
export function estimateCreatorPostFee(input: {
  followers?: number;
  platform?: string;
  currency?: string;
  rateCardAmount?: number | null;
  quotationAvgCost?: number | null;
  quotationQuoteCount?: number;
  quotationCurrency?: string;
  deliverableLabel?: string;
}): string | undefined {
  if (input.quotationAvgCost != null && input.quotationAvgCost > 0) {
    const currency = input.quotationCurrency ?? input.currency ?? "EGP";
    const count = input.quotationQuoteCount ?? 1;
    const countLabel = count === 1 ? "1 quote" : `${count} quotes`;
    const label = input.deliverableLabel ?? `avg from ${countLabel}`;
    return `${formatMoney(input.quotationAvgCost, currency)} · ${label}`;
  }

  if (input.rateCardAmount != null && input.rateCardAmount > 0) {
    const currency = input.currency ?? "EGP";
    const label = input.deliverableLabel ?? "1 post";
    return `${formatMoney(input.rateCardAmount, currency)} · ${label}`;
  }

  const followers = input.followers;
  if (followers == null || followers <= 0) return undefined;

  const tier = resolveCreatorTierLabel({ followers });
  const tierKey = TIER_BENCHMARK_KEY[tier.toLowerCase()] ?? "mid";
  const bench = EGP_POST_BENCHMARKS[tierKey];

  const platformKey = (input.platform ?? "instagram").toLowerCase();
  const multiplier =
    Object.entries(PLATFORM_MULTIPLIER).find(([k]) => platformKey.includes(k))?.[1] ?? 1;

  const midEgp = ((bench.min + bench.max) / 2) * multiplier;
  const currency = (input.currency ?? "EGP").toUpperCase();
  const amount = currency === "EGP" ? midEgp : egpToCurrency(midEgp, currency);

  return `${formatMoney(amount, currency)} · est. 1 ${platformKey.includes("tiktok") ? "TikTok" : platformKey.includes("youtube") ? "YouTube" : "IG"} post`;
}
