import {
  formatMoneyDetail,
  formatMoneyKpi,
} from "@/lib/finance/currency-format";

export function formatBillingMoney(amount: number, currency = "USD"): string {
  return formatMoneyDetail(amount, currency);
}

export function formatBillingMoneyCompact(amount: number, currency = "USD"): string {
  return formatMoneyKpi(amount, currency);
}

export {
  formatCurrencyAmount,
  formatMoneyDetail,
  formatMoneyKpi,
  currencySymbol,
} from "@/lib/finance/currency-format";
