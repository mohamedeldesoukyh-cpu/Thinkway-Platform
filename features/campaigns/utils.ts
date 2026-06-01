import { METADATA_PLATFORM_KEY } from "./constants";

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
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
