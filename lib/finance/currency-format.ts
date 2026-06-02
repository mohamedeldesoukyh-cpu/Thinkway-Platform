/**
 * Centralized currency display for finance surfaces.
 * Uses symbol-first formatting (e.g. £600,000 · $9,000 · €12,500).
 */

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  EGP: "£",
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

export type FormatCurrencyOptions = {
  /** Decimal places — defaults to 2 for ledger precision, use 0 for KPI cards. */
  decimals?: number;
  /** Show ISO code after amount (e.g. "1,000 USD") */
  showCode?: boolean;
};

function normalizeCurrencyCode(currency: string | null | undefined): string {
  const code = (currency ?? "USD").trim().toUpperCase();
  return code.length === 3 ? code : "USD";
}

function formatNumber(amount: number, decimals: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safe);
}

export function currencySymbol(currency: string | null | undefined): string {
  const code = normalizeCurrencyCode(currency);
  return CURRENCY_SYMBOLS[code] ?? `${code} `;
}

/** Symbol-first amount: £600,000.00 */
export function formatCurrencyAmount(
  amount: number,
  currency: string | null | undefined,
  options: FormatCurrencyOptions = {}
): string {
  const code = normalizeCurrencyCode(currency);
  const decimals = options.decimals ?? 2;
  const symbol = CURRENCY_SYMBOLS[code] ?? `${code} `;
  const formatted = formatNumber(amount, decimals);

  if (options.showCode && !CURRENCY_SYMBOLS[code]) {
    return `${formatted} ${code}`;
  }

  const trailingSymbol = symbol.endsWith(" ");
  if (trailingSymbol) {
    return `${symbol.trim()} ${formatted}`;
  }

  return `${symbol}${formatted}`;
}

/** Delegates to Intl when a locale currency string is needed (legacy surfaces). */
export function formatIntlCurrency(
  amount: number,
  currency: string | null | undefined,
  maximumFractionDigits = 2
): string {
  const code = normalizeCurrencyCode(currency);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits,
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return formatCurrencyAmount(amount, code, { decimals: maximumFractionDigits });
  }
}

if (process.env.NODE_ENV === "development") {
  const sample = [
    { amount: 600_000, currency: "EGP" },
    { amount: 9_000, currency: "USD" },
    { amount: 12_500, currency: "EUR" },
  ];
  for (const row of sample) {
    console.debug("[currency-format] normalized", row.currency, "→", formatCurrencyAmount(row.amount, row.currency, { decimals: 0 }));
  }
}
