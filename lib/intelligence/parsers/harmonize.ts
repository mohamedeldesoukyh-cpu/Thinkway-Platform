import { createHash } from "node:crypto";

import { parseMoney } from "@/lib/intelligence/parsers/money";
import { parsePercent } from "@/lib/intelligence/parsers/percent";
import { stripEmoji } from "@/lib/intelligence/parsers/row-filter";
import type { HarmonizedCampaignRow, IntelligenceSheet } from "@/types/intelligence";

function cell(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    if (row[key] == null) continue;
    const text = String(row[key]).trim();
    if (text) return text;
  }
  return null;
}

function parseBool(value: unknown): boolean | null {
  if (value == null || value === "") return null;
  const raw = String(value).trim().toLowerCase();
  if (["yes", "true", "1", "y"].includes(raw)) return true;
  if (["no", "false", "0", "n"].includes(raw)) return false;
  return null;
}

function parseWeek(value: unknown): number | null {
  const raw = cell({ v: value }, "v");
  if (!raw) return null;
  const match = raw.match(/week\s*(\d+)/i) ?? raw.match(/^(\d+)$/);
  if (!match) return null;
  const week = Number(match[1]);
  return week >= 1 && week <= 4 ? week : null;
}

function parseIsoDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function titleCaseChannel(value: string | null): string | null {
  if (!value) return null;
  const lower = value.trim().toLowerCase();
  const map: Record<string, string> = {
    snapchat: "Snapchat",
    "insta story": "Instagram",
    instagram: "Instagram",
    tiktok: "TikTok",
    twitter: "Twitter",
    "twitter campaign": "Twitter",
    youtube: "YouTube",
  };
  return map[lower] ?? value.trim();
}

export function normalizeCampaignKey(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const modern = trimmed.match(/\(26\)\s*Camp-(\d+)/i);
  if (modern) return `Camp-${modern[1]}`;
  const legacy = trimmed.match(/^Camp-(\d+)$/i);
  if (legacy) return `Camp-${legacy[1]}`;
  return trimmed;
}

function buildSourceLineId(
  sheet: IntelligenceSheet,
  row: Record<string, unknown>,
  rowNumber: number
): { source_line_id: string; source_campaign_key: string | null; source_line_key: string | null } {
  const camp = normalizeCampaignKey(cell(row, "Camp#"));
  const code = cell(row, "Code#");
  const campaignName = cell(row, "Campaign Name");
  const month = cell(row, "Month", "Month of ad live");
  const entity = cell(row, "Entity");
  const influencer = cell(row, "INFLUENCER");

  if (camp && code) {
    return {
      source_line_id: `${sheet}|${camp}|${code}`,
      source_campaign_key: camp,
      source_line_key: code,
    };
  }

  if (sheet === "2023" && campaignName) {
    const syntheticCamp = `${campaignName}|${month ?? ""}|${entity ?? ""}`;
    const syntheticLine = `${syntheticCamp}|${influencer ?? ""}|${rowNumber}`;
    return {
      source_line_id: `${sheet}|${syntheticLine}`,
      source_campaign_key: syntheticCamp,
      source_line_key: String(rowNumber),
    };
  }

  if (campaignName && influencer) {
    return {
      source_line_id: `${sheet}|${campaignName}|${influencer}|${rowNumber}`,
      source_campaign_key: campaignName,
      source_line_key: String(rowNumber),
    };
  }

  return {
    source_line_id: `${sheet}|row-${rowNumber}`,
    source_campaign_key: camp ?? campaignName,
    source_line_key: code,
  };
}

function inferPeriodYear(sheet: IntelligenceSheet, adLiveDate: string | null): number {
  if (adLiveDate) return Number(adLiveDate.slice(0, 4));
  return Number(sheet);
}

export function harmonizeCampaignRow(
  sheet: IntelligenceSheet,
  row: Record<string, unknown>,
  rowNumber: number
): HarmonizedCampaignRow {
  const adLiveDate = parseIsoDate(row["Date"] ?? row["Add live date"]);
  const revenue = parseMoney(row["Revenue ($) ROI"] ?? row["Revenue ($)"]);
  const cost = parseMoney(row["Cost ($)"] ?? row["Our Cost ($)"] ?? row["our cost"]);
  let gp = parseMoney(row["Profit ($)"]);
  if (gp == null && revenue != null && cost != null) {
    gp = Math.round((revenue - cost) * 100) / 100;
  }

  let marginPct = parsePercent(row["Profit Margin %"]);
  if (marginPct == null && revenue != null && revenue > 0 && gp != null) {
    marginPct = Math.round((gp / revenue) * 10000) / 100;
  }

  const keys = buildSourceLineId(sheet, row, rowNumber);

  return {
    source_sheet: sheet,
    source_row_number: rowNumber,
    ...keys,
    ad_live_month: cell(row, "Month of ad live", "Month"),
    ad_live_date: adLiveDate,
    budget_month: cell(row, "Budget Month"),
    campaign_name: cell(row, "Campaign Name"),
    campaign_type: cell(row, "Campaign Type"),
    market_entity: cell(row, "Entity"),
    channel: titleCaseChannel(cell(row, "Channel")),
    went_live: parseBool(row["Went live"]),
    ad_live_week: parseWeek(row["Week"]),
    revenue_usd: revenue,
    cost_usd: cost,
    gp_usd: gp,
    margin_pct: marginPct,
    markup_pct: parsePercent(row["Markup Margin %"]),
    io_amount_local: parseMoney(row["IO Amount in Local Currancy"]),
    io_currency: cell(row, "IO Currancy"),
    billing_moved: cell(row, "Moved/Not Moved to Billing"),
    invoiced_flag: cell(row, "Invoiced"),
    invoice_number_ref: cell(row, "Invoice #"),
    vendor_paid_flag: cell(row, "Vendor Paid Confirmation", "Paid Confirmation"),
    locked_flag: cell(row, "Locked/Unlocked"),
    direct_agency: cell(row, "Direct/Agency"),
    client_type_report: cell(row, "Report Client type", "Client Type"),
    ops_team: cell(row, "Team", "Owner"),
    planning_status: cell(row, "Actual/Budget in Hand"),
    category_raw: stripEmoji(cell(row, "Category")),
    subcategory_raw: stripEmoji(cell(row, "Sub Category")),
    agency_name_raw: cell(row, "Agent / Agency", "Agency/Agent"),
    account_manager_raw: cell(row, "Team Member", "Team Member 1", "Sales Person"),
    influencer_name_raw: cell(row, "INFLUENCER"),
    client_name_raw: cell(row, "Client Name"),
    group_name_raw: cell(row, "Group Name"),
    brand_name_raw: cell(row, "Brand"),
    period_year: inferPeriodYear(sheet, adLiveDate),
  };
}

export function payloadFromRow(row: Record<string, unknown>): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value == null || value === "") {
      out[key] = null;
      continue;
    }
    if (value instanceof Date) {
      out[key] = value.toISOString().slice(0, 10);
      continue;
    }
    out[key] = String(value);
  }
  return out;
}

export function hashRow(sheet: string, rowNumber: number, payload: Record<string, string | null>): string {
  const digest = createHash("sha256");
  digest.update(sheet);
  digest.update(String(rowNumber));
  digest.update(JSON.stringify(payload));
  return digest.digest("hex");
}
