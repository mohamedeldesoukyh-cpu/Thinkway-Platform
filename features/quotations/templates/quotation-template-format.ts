import { formatCreatorCount } from "@/features/discovery/components/creator-search/creator-search-utils";
import { formatCurrencyAmount } from "@/lib/finance/currency-format";

/** Full number with thousands separators (e.g. 15,791,000). Display-only whole numbers. */
export function formatQuotationFullNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Engagement rate for Preview/export — always two decimal places (e.g. 3.51%). */
export function formatQuotationEngagementRate(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

/** Short platform label for showcase metric cards (IG · TT · YT …). */
export function quotationPlatformShortLabel(platform: string): string {
  const key = platform.trim().toLowerCase();
  if (key === "instagram" || key === "ig") return "IG";
  if (key === "tiktok" || key === "tt") return "TT";
  if (key === "youtube" || key === "yt") return "YT";
  if (key === "facebook" || key === "fb") return "FB";
  if (key === "snapchat" || key === "sc") return "SC";
  if (key.startsWith("instagram") || key.startsWith("ig_")) return "IG";
  if (key.startsWith("tiktok") || key.startsWith("tt_")) return "TT";
  if (key.startsWith("youtube") || key.startsWith("yt_")) return "YT";
  if (key.startsWith("facebook") || key.startsWith("fb_")) return "FB";
  if (key.startsWith("snapchat")) return "SC";
  return key.slice(0, 2).toUpperCase() || "—";
}

/**
 * One Engagement card value listing every platform ER
 * (e.g. "IG 3.20% · TT 5.10%"). Falls back to combined ER.
 */
export function formatShowcaseEngagementCardValue(input: {
  engagement: string;
  platformMetrics: Array<{ platform: string; engagement: string }>;
}): string {
  const parts = input.platformMetrics
    .filter((row) => row.engagement.trim() && row.engagement.trim() !== "—")
    .map(
      (row) =>
        `${quotationPlatformShortLabel(row.platform)} ${row.engagement.trim()}`
    );
  if (parts.length > 0) return parts.join(" · ");
  return input.engagement.trim() || "—";
}

/** Short reach/follower label (e.g. 16M, 541K) — whole numbers only. */
export function formatQuotationShortNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000) {
    return `${Math.round(value / 1_000_000)}M`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K`;
  }
  return String(Math.round(value));
}

export function parseQuotationMoneyString(value: string): {
  amount: number;
  currency: string;
} | null {
  const trimmed = value.trim();
  const dual = trimmed.match(/^([\d,.\s]+)\s+(\w+)\s+\/\s+([\d,.\s]+)\s+(\w+)$/);
  if (dual) {
    const amount = Number(dual[3]!.replace(/,/g, ""));
    return Number.isFinite(amount) ? { amount, currency: dual[4]! } : null;
  }
  // "268,333.34 AED"
  const amountFirst = trimmed.match(/^([\d,.\s]+)\s+([A-Za-z]{3})$/);
  if (amountFirst) {
    const amount = Number(amountFirst[1]!.replace(/,/g, ""));
    return Number.isFinite(amount)
      ? { amount, currency: amountFirst[2]!.toUpperCase() }
      : null;
  }
  // "AED 268,333.34"
  const codeFirst = trimmed.match(/^([A-Za-z]{3})\s+([\d,.]+)$/);
  if (codeFirst) {
    const amount = Number(codeFirst[2]!.replace(/,/g, ""));
    return Number.isFinite(amount)
      ? { amount, currency: codeFirst[1]!.toUpperCase() }
      : null;
  }
  // "E£542,857.16" / "$1,234.00"
  const symbolFirst = trimmed.match(/^(E£|\$|€|£|¥)([\d,.]+)$/);
  if (symbolFirst) {
    const amount = Number(symbolFirst[2]!.replace(/,/g, ""));
    if (!Number.isFinite(amount)) return null;
    const sym = symbolFirst[1]!;
    const currency =
      sym === "$" ? "USD" : sym === "€" ? "EUR" : sym === "¥" ? "JPY" : "EGP";
    return { amount, currency };
  }
  return null;
}

/** Detailed quotation money — ISO code; Preview/export use whole numbers only. */
export function formatQuotationCurrencySymbolFirst(
  amount: number,
  currency = "EGP",
  decimals = 0
): string {
  return formatCurrencyAmount(amount, currency, { decimals });
}

/** Abbreviated currency for cover stats (EGP 4M / AED 268K) — whole numbers only. */
export function formatQuotationCurrencyShort(amount: number, currency = "EGP"): string {
  const code = (currency || "EGP").trim().toUpperCase() || "EGP";
  if (amount >= 1_000_000) {
    return `${code} ${Math.round(amount / 1_000_000)}M`;
  }
  if (amount >= 1_000) {
    return `${code} ${Math.round(amount / 1_000)}K`;
  }
  return formatQuotationCurrencySymbolFirst(amount, currency);
}

export function formatQuotationMoneyDisplay(value: string): {
  full: string;
  short: string;
} {
  const parsed = parseQuotationMoneyString(value);
  if (!parsed) return { full: value, short: value };
  const full = formatQuotationCurrencySymbolFirst(parsed.amount, parsed.currency);
  return { full, short: formatQuotationCurrencyShort(parsed.amount, parsed.currency) };
}

export function creatorCountLabel(count: number): string {
  return count === 1 ? "creator" : "creators";
}

export function tierProfileCountLabel(count: number): string {
  return count === 1 ? "1 profile" : `${count} profiles`;
}

export function tierSlugFromLabel(label: string): string {
  const key = label.trim().toLowerCase();
  if (key === "celebrity") return "celebrity";
  if (key === "mega") return "mega";
  if (key === "macro") return "macro";
  if (key === "mid" || key === "micro" || key === "nano") return "mid";
  return "unknown";
}

export function showcaseInitialsFromHandle(handle: string): string {
  const stripped = handle.replace(/^@/, "").replace(/[^a-zA-Z0-9]/g, "");
  return (stripped.slice(0, 2) || "??").toUpperCase();
}

export function formatReachAccountsLabel(fullReach: string): string {
  const numeric = Number(fullReach.replace(/,/g, ""));
  if (Number.isFinite(numeric) && numeric > 0) {
    return `${formatQuotationFullNumber(numeric)} accounts`;
  }
  return "accounts";
}

export function tierSummaryLabel(tierBreakdown: Array<{ label: string; count: number }>): string {
  const active = tierBreakdown.filter((row) => row.count > 0);
  if (!active.length) return "";
  const count = active.length;
  return `across ${count} tier${count === 1 ? "" : "s"}`;
}

export function parseNumericFromFormatted(value: string): number | null {
  if (!value || value === "—") return null;
  const parsed = Number(value.replace(/,/g, "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function sumFormattedFollowers(values: string[]): number {
  return values.reduce((sum, value) => {
    const parsed = parseNumericFromFormatted(value);
    return sum + (parsed ?? 0);
  }, 0);
}

/** Re-export for tier rows that already use formatCreatorCount. */
export { formatCreatorCount };
