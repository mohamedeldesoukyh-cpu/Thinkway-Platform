import { formatCreatorCount } from "@/features/discovery/components/creator-search/creator-search-utils";
import { currencySymbol } from "@/lib/finance/currency-format";

/** Full number with thousands separators (e.g. 15,791,000). */
export function formatQuotationFullNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

/** Short reach/follower label (e.g. 15.79M, 541.4K). */
export function formatQuotationShortNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000) {
    const scaled = value / 1_000_000;
    return scaled >= 10 ? `${scaled.toFixed(1)}M` : `${scaled.toFixed(2)}M`;
  }
  if (value >= 1_000) {
    const scaled = value / 1_000;
    return scaled >= 100 ? `${Math.round(scaled)}K` : `${scaled.toFixed(1)}K`;
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

/** Symbol-first currency (E£1,234,567.89). */
export function formatQuotationCurrencySymbolFirst(
  amount: number,
  currency = "EGP",
  decimals = 2
): string {
  const symbol = currencySymbol(currency);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(amount) ? amount : 0);
  if (symbol.endsWith(" ")) return `${symbol.trim()} ${formatted}`;
  return `${symbol}${formatted}`;
}

/** Abbreviated currency for cover stats (E£3.50M / AED 268.33K). */
export function formatQuotationCurrencyShort(amount: number, currency = "EGP"): string {
  const rawSymbol = currencySymbol(currency);
  // Letter codes (AED, SAR) keep a space; glyph symbols (E£, $) stay glued.
  const prefix = rawSymbol.endsWith(" ") ? `${rawSymbol.trim()} ` : rawSymbol.trim();
  if (amount >= 1_000_000) {
    return `${prefix}${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (amount >= 1_000) {
    return `${prefix}${(amount / 1_000).toFixed(2)}K`;
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
