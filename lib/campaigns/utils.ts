import { METADATA_PLATFORM_KEY } from "@/lib/campaigns/constants";
import {
  formatCurrencyAmount,
  formatMoneyDetail,
  formatMoneyKpi,
} from "@/lib/finance/currency-format";

export {
  documentNumberDisplayTitle,
  formatDocumentNumberForDisplay,
} from "@/lib/documents/format-document-number";

export function getCampaignPlatform(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  const value = metadata?.[METADATA_PLATFORM_KEY];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function formatPlatformLabel(platform: string | null): string {
  if (!platform) {
    return "—";
  }

  return platform
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Detailed financial display — ISO code + two decimals (ledger / documents). */
export function formatMoney(amount: number, currency: string): string {
  return formatMoneyDetail(amount, currency);
}

/** Executive KPI / summary cards — ISO code + whole units (no decimals). */
export function formatMoneyCompact(amount: number, currency: string): string {
  return formatMoneyKpi(amount, currency);
}

export { formatCurrencyAmount, formatMoneyDetail, formatMoneyKpi };

export function formatPercent(value: number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.0%";
  return `${n.toFixed(1)}%`;
}
