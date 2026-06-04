import { METADATA_PLATFORM_KEY } from "./constants";
import { formatCurrencyAmount } from "@/lib/finance/currency-format";

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

export function formatMoney(amount: number, currency: string): string {
  return formatCurrencyAmount(amount, currency, { decimals: 2 });
}

/** KPI / queue display — whole units with symbol prefix. */
export function formatMoneyCompact(amount: number, currency: string): string {
  return formatCurrencyAmount(amount, currency, { decimals: 0 });
}

export function formatPercent(value: number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.0%";
  return `${n.toFixed(1)}%`;
}
