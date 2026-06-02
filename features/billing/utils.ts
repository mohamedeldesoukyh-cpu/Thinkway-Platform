import { formatCurrencyAmount } from "@/lib/finance/currency-format";

export function formatBillingMoney(amount: number, currency = "USD"): string {
  return formatCurrencyAmount(amount, currency, { decimals: 2 });
}

export function formatBillingMoneyCompact(amount: number, currency = "USD"): string {
  return formatCurrencyAmount(amount, currency, { decimals: 0 });
}

export { formatCurrencyAmount, currencySymbol } from "@/lib/finance/currency-format";
