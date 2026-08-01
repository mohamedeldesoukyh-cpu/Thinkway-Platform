import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";

/**
 * Thinkway Platform Financial Display Standard.
 *
 * Always display ISO currency codes (never localized symbols):
 *   KPI / executive:  EGP 1,235,561
 *   Detail / ledger:  EGP 1,235,561.00
 *
 * Spec: docs/architecture/FINANCIAL_DISPLAY_STANDARD.md
 */

/** @deprecated Legacy symbol map — kept only for parsing historical inputs. Never use for display. */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  EGP: "E£",
  AED: "AED ",
  SAR: "SAR ",
  CAD: "CA$",
  AUD: "A$",
  CHF: "CHF ",
  JPY: "¥",
  KWD: "KD ",
  QAR: "QR ",
  BHD: "BD ",
  OMR: "OMR ",
};

export type MoneyDisplayPrecision = "kpi" | "detail";

export type FormatCurrencyOptions = {
  /**
   * Explicit decimal places. When omitted, `precision` controls the default
   * (`kpi` → 0, `detail` → 2).
   */
  decimals?: number;
  /** Display precision band. Defaults to `detail` (two decimals). */
  precision?: MoneyDisplayPrecision;
  /**
   * @deprecated ISO currency codes are always shown. Ignored.
   */
  showCode?: boolean;
};

function normalizeCurrencyCode(currency: string | null | undefined): string {
  const code = (currency ?? DEFAULT_PLATFORM_CURRENCY).trim().toUpperCase();
  return code.length === 3 ? code : DEFAULT_PLATFORM_CURRENCY;
}

function resolveDecimals(options: FormatCurrencyOptions): number {
  if (typeof options.decimals === "number" && Number.isFinite(options.decimals)) {
    return Math.max(0, Math.min(6, Math.trunc(options.decimals)));
  }
  return options.precision === "kpi" ? 0 : 2;
}

function formatNumber(amount: number, decimals: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safe);
}

/**
 * @deprecated Do not use for display. Prefer `formatCurrencyAmount`.
 * Retained only for parsing legacy symbol-prefixed strings.
 */
export function currencySymbol(currency: string | null | undefined): string {
  const code = normalizeCurrencyCode(currency);
  return CURRENCY_SYMBOLS[code] ?? `${code} `;
}

/**
 * Canonical money formatter — ISO code + grouped amount.
 * Example: `EGP 1,235,561.00` (detail) · `EGP 1,235,561` (kpi)
 */
export function formatCurrencyAmount(
  amount: number,
  currency: string | null | undefined,
  options: FormatCurrencyOptions = {}
): string {
  const code = normalizeCurrencyCode(currency);
  const decimals = resolveDecimals(options);
  return `${code} ${formatNumber(amount, decimals)}`;
}

/** Detailed / ledger money — always two decimal places. */
export function formatMoneyDetail(
  amount: number,
  currency: string | null | undefined
): string {
  return formatCurrencyAmount(amount, currency, { precision: "detail" });
}

/** Executive KPI money — whole units, no decimals. */
export function formatMoneyKpi(
  amount: number,
  currency: string | null | undefined
): string {
  return formatCurrencyAmount(amount, currency, { precision: "kpi" });
}

/**
 * @deprecated Prefer `formatCurrencyAmount` / `formatMoneyDetail`.
 * Kept as a thin alias that now emits ISO codes (not Intl locale symbols).
 */
export function formatIntlCurrency(
  amount: number,
  currency: string | null | undefined,
  maximumFractionDigits = 2
): string {
  return formatCurrencyAmount(amount, currency, {
    decimals: maximumFractionDigits,
  });
}
