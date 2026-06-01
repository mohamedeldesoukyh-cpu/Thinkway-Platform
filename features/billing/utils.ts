import { formatMoney } from "@/features/campaigns/utils";

export function formatBillingMoney(amount: number, currency = "USD"): string {
  return formatMoney(amount, currency);
}
