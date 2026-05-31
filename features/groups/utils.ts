import { formatMoney } from "@/features/campaigns/utils";

export function formatGroupMoney(amount: number): string {
  return formatMoney(amount, "USD");
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
