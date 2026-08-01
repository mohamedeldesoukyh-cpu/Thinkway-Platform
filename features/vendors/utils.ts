import type { InfluencerStatus, PaymentTerms } from "@/types/database";
import { formatMoneyKpi } from "@/lib/finance/currency-format";
import {
  PAYMENT_TERMS_OPTIONS,
  VENDOR_PAYMENT_METHOD_OPTIONS,
  labelForOption,
} from "@/lib/master-data/constants";

export type PlatformAccountSummary = {
  platform: string;
  handle?: string;
  follower_count?: number | null;
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
): number | null {
  if (!accounts?.length) {
    return null;
  }

  const known = accounts
    .map((account) => account.follower_count)
    .filter((count): count is number => count != null);

  if (known.length === 0) {
    return null;
  }

  return known.reduce((sum, count) => sum + count, 0);
}

export function formatFollowers(count: number | null): string {
  if (count == null) {
    return "—";
  }

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
  return formatMoneyKpi(parsed.base_rate, currency);
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

export function formatMoney(amount: number, currency = "USD"): string {
  return formatMoneyKpi(amount, currency);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export type VendorPaymentDetailsForm = {
  beneficiary_name: string;
  payment_method: string;
  bank_name: string;
  bank_branch: string;
  account_number: string;
  swift: string;
  iban: string;
};

function paymentDetailString(
  details: Record<string, unknown> | null | undefined,
  key: string
): string {
  const value = details?.[key];
  return typeof value === "string" ? value : "";
}

export function parseVendorPaymentDetails(
  details: Record<string, unknown> | null | undefined
): VendorPaymentDetailsForm {
  return {
    beneficiary_name: paymentDetailString(details, "beneficiary_name"),
    payment_method: paymentDetailString(details, "method") || "bank_transfer",
    bank_name: paymentDetailString(details, "bank_name"),
    bank_branch: paymentDetailString(details, "bank_branch"),
    account_number: paymentDetailString(details, "account_number"),
    swift: paymentDetailString(details, "swift"),
    iban: paymentDetailString(details, "iban"),
  };
}

export function formatPaymentTermsLabel(
  paymentTerms: PaymentTerms | null | undefined
): string {
  if (!paymentTerms) {
    return "Net 30 Days from Invoice";
  }
  return (
    labelForOption(PAYMENT_TERMS_OPTIONS, paymentTerms) ??
    paymentTerms.replace(/_/g, " ")
  );
}

export function hasVendorBankDetails(
  details: Record<string, unknown> | null | undefined
): boolean {
  const parsed = parseVendorPaymentDetails(details);
  return Boolean(
    parsed.bank_name.trim() ||
      parsed.account_number.trim() ||
      parsed.iban.trim() ||
      parsed.swift.trim()
  );
}

export function formatPaymentMethodLabel(method: string | null | undefined): string {
  if (!method) {
    return "Bank transfer";
  }
  return (
    labelForOption(VENDOR_PAYMENT_METHOD_OPTIONS, method) ??
    method.replace(/_/g, " ")
  );
}
