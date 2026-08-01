import { formatMoneyDetail } from "@/lib/finance/currency-format";

export function formatPortalCurrency(amount: number, currency: string) {
  return formatMoneyDetail(amount, currency);
}

export function formatPortalDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

export function formatPortalDateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "—";
}
