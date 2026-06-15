import {
  buildNormalizedRowLookup,
  hasMoneyInRow,
  lookupCell,
} from "@/lib/intelligence/parsers/header-normalize";
import type { IntelligenceSheet } from "@/types/intelligence";

const INFLUENCER_ALIASES = ["INFLUENCER", "Influencer NEW name", "Influencer OLD Name"] as const;
const REVENUE_ALIASES = ["Revenue ($) ROI", "Revenue ($)", "Revenue"] as const;
const CAMP_ALIASES = ["Camp#", "Campaign Name"] as const;
const COST_ALIASES = ["Cost ($)", "Our Cost ($)", "our cost"] as const;

/**
 * Drops blank layout rows (2024 ~68%, 2026 ~50% padding).
 * Keeps rows with influencer OR revenue OR camp#/campaign identity.
 */
export function isCampaignDataRow(
  row: Record<string, unknown>,
  sheet: IntelligenceSheet
): boolean {
  const normalized = buildNormalizedRowLookup(row);
  const influencer = lookupCell(normalized, ...INFLUENCER_ALIASES);
  const revenue = hasMoneyInRow(normalized, ...REVENUE_ALIASES);
  const camp = lookupCell(normalized, ...CAMP_ALIASES);
  const code = lookupCell(normalized, "Code#");
  const cost = hasMoneyInRow(normalized, ...COST_ALIASES);

  if (influencer || revenue || cost) return true;
  if (camp && (code || influencer)) return true;

  if (sheet === "2023") {
    const campaignName = lookupCell(normalized, "Campaign Name");
    const month = lookupCell(normalized, "Month");
    return Boolean(campaignName && month);
  }

  return false;
}

export function isDatabaseDataRow(row: Record<string, unknown>): boolean {
  const normalized = buildNormalizedRowLookup(row);
  const newName = lookupCell(normalized, "Influencer NEW name");
  const oldName = lookupCell(normalized, "Influencer OLD Name");
  const username = lookupCell(normalized, "Username");
  const platform = lookupCell(normalized, "Platform");
  return Boolean(newName || oldName || username || platform);
}

export function stripEmoji(value: string | null): string | null {
  if (!value) return null;
  const stripped = value.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "").trim();
  return stripped.length > 0 ? stripped : null;
}
