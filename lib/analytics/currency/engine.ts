import {
  currencySymbol,
  formatCurrencyAmount,
  type FormatCurrencyOptions,
} from "@/lib/finance/currency-format";

import { devLog } from "@/lib/dev-log";
import type { AnalyticsCurrencyContext } from "@/lib/analytics/types/metrics";

export type { FormatCurrencyOptions };

export {
  currencySymbol,
  formatCurrencyAmount,
  CURRENCY_SYMBOLS,
} from "@/lib/finance/currency-format";

/** Build currency context from fact currencies (no FX conversion in Sprint 1A). */
export function buildCurrencyContext(
  currencyCodes: string[],
  options?: { preserveCampaignCurrency?: boolean }
): AnalyticsCurrencyContext {
  const normalized = [
    ...new Set(
      currencyCodes
        .map((c) => (c ?? "USD").trim().toUpperCase())
        .filter((c) => c.length === 3)
    ),
  ];

  const is_mixed_currency = normalized.length > 1;
  const primary_currency = normalized.length === 1 ? normalized[0]! : null;
  const mixed_label = is_mixed_currency
    ? `Mixed (${normalized.join(", ")})`
    : null;

  if (process.env.NODE_ENV === "development" && is_mixed_currency) {
    devLog("[currency-engine] mixed currency slice detected", {
      currencies: normalized,
      preserveCampaignCurrency: options?.preserveCampaignCurrency ?? true,
    });
  }

  return {
    primary_currency,
    is_mixed_currency,
    currencies: normalized,
    mixed_label,
  };
}

export function formatAnalyticsAmount(
  amount: number,
  context: AnalyticsCurrencyContext,
  options: FormatCurrencyOptions = {}
): string {
  if (context.is_mixed_currency) {
    const decimals = options.decimals ?? 0;
    const formatted = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(Number.isFinite(amount) ? amount : 0);
    return `${formatted} ${context.mixed_label ?? "mixed"}`;
  }

  return formatCurrencyAmount(
    amount,
    context.primary_currency ?? "USD",
    options
  );
}

/**
 * Future-ready FX hook — returns amount unchanged until warehouse FX is wired.
 */
export function convertAnalyticsAmount(input: {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  exchangeRate?: number;
}): number {
  const rate = input.exchangeRate ?? 1;
  if (input.fromCurrency === input.toCurrency || rate === 1) {
    return Math.round(input.amount * 100) / 100;
  }

  if (process.env.NODE_ENV === "development") {
    devLog("[currency-engine] FX conversion placeholder", {
      from: input.fromCurrency,
      to: input.toCurrency,
      rate,
    });
  }

  return Math.round(input.amount * rate * 100) / 100;
}
