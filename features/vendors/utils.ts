import type { InfluencerStatus } from "@/types/database";

export type PlatformAccountSummary = {
  platform: string;
  handle?: string;
  follower_count?: number;
  is_primary?: boolean;
};

import { PLATFORM_OPTIONS, VENDOR_STATUS_OPTIONS } from "./constants";

export function formatVendorStatus(status: InfluencerStatus): string {
  return (
    VENDOR_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status
  );
}

export function formatPlatformLabel(platform: string): string {
  return (
    PLATFORM_OPTIONS.find((option) => option.value === platform)?.label ??
    platform
  );
}

export function parseCategoriesInput(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseLanguagesInput(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function formatLanguagesList(languages: string[] | null | undefined) {
  if (!languages?.length) {
    return "—";
  }

  return languages.join(", ");
}

export function formatCategoriesList(categories: string[] | null | undefined) {
  if (!categories?.length) {
    return "—";
  }

  return categories.join(", ");
}

export function getPrimaryPlatformAccount(
  accounts: PlatformAccountSummary[] | null | undefined
): PlatformAccountSummary | null {
  if (!accounts?.length) {
    return null;
  }

  return accounts.find((account) => account.is_primary) ?? accounts[0] ?? null;
}

export function getTotalFollowers(
  accounts: PlatformAccountSummary[] | null | undefined
): number {
  if (!accounts?.length) {
    return 0;
  }

  return accounts.reduce(
    (sum, account) => sum + Number(account.follower_count ?? 0),
    0
  );
}

export function formatFollowers(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }

  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }

  return count.toLocaleString();
}

export type RateCard = {
  base_rate?: number;
  currency?: string;
};

export function parseRateCard(
  value: Record<string, unknown> | null | undefined
): RateCard {
  if (!value || typeof value !== "object") {
    return {};
  }

  const baseRate = value.base_rate;
  const currency = value.currency;

  return {
    base_rate:
      typeof baseRate === "number"
        ? baseRate
        : typeof baseRate === "string"
          ? Number(baseRate)
          : undefined,
    currency: typeof currency === "string" ? currency : undefined,
  };
}

export function formatPricing(
  rateCard: Record<string, unknown> | null | undefined
): string {
  const parsed = parseRateCard(rateCard);

  if (parsed.base_rate == null || Number.isNaN(parsed.base_rate)) {
    return "—";
  }

  const currency = parsed.currency ?? "USD";

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(parsed.base_rate);
}

export function formatPlatformsSummary(
  accounts: PlatformAccountSummary[] | null | undefined
): string {
  if (!accounts?.length) {
    return "—";
  }

  const labels = accounts.map((account) =>
    formatPlatformLabel(account.platform)
  );

  return [...new Set(labels)].join(", ");
}
