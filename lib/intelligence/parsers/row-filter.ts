import type { IntelligenceSheet } from "@/types/intelligence";

function cell(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function hasMoney(value: unknown): boolean {
  if (value == null || value === "") return false;
  if (typeof value === "number") return true;
  return /\d/.test(String(value));
}

const INFLUENCER_KEYS = ["INFLUENCER", "Influencer NEW name", "Influencer OLD Name"] as const;
const REVENUE_KEYS = [
  "Revenue ($) ROI",
  "Revenue ($)",
  "Revenue",
] as const;
const CAMP_KEYS = ["Camp#", "Campaign Name"] as const;

function firstPresent(row: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = cell(row[key]);
    if (value) return value;
  }
  return null;
}

/**
 * Drops blank layout rows (2024 ~68%, 2026 ~50% padding).
 * Keeps rows with influencer OR revenue OR camp#/campaign identity.
 */
export function isCampaignDataRow(
  row: Record<string, unknown>,
  sheet: IntelligenceSheet
): boolean {
  const influencer = firstPresent(row, INFLUENCER_KEYS);
  const revenue = REVENUE_KEYS.some((key) => hasMoney(row[key]));
  const camp = firstPresent(row, CAMP_KEYS);
  const code = cell(row["Code#"]);
  const cost = hasMoney(row["Cost ($)"] ?? row["Our Cost ($)"] ?? row["our cost"]);

  if (influencer || revenue || cost) return true;
  if (camp && (code || influencer)) return true;

  if (sheet === "2023") {
    const campaignName = cell(row["Campaign Name"]);
    const month = cell(row["Month"]);
    return Boolean(campaignName && month);
  }

  return false;
}

export function isDatabaseDataRow(row: Record<string, unknown>): boolean {
  const newName = cell(row["Influencer NEW name"]);
  const oldName = cell(row["Influencer OLD Name"]);
  const username = cell(row["Username"]);
  const platform = cell(row["Platform"]);
  return Boolean(newName || oldName || username || platform);
}

export function stripEmoji(value: string | null): string | null {
  if (!value) return null;
  const stripped = value.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "").trim();
  return stripped.length > 0 ? stripped : null;
}
