import type { SupabaseClient } from "@supabase/supabase-js";

import { platformLabel } from "@/lib/campaigns/line-assignment";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { formatMoneyKpi } from "@/lib/finance/currency-format";
import {
  deliverableTypeValues,
  formatQuotationDeliverablesSummary,
  platformsFromSelectedPostTypes,
  typeLinesIncludeAllPlatforms,
} from "@/lib/quotations/quotation-deliverable-types";
import type { Database } from "@/types/database";

export type CreatorQuotationPriceEntry = {
  quotation_id: string;
  quotation_serial: string | null;
  quotation_name: string | null;
  cost: number;
  cost_currency: string;
  cost_egp: number;
  quoted_at: string;
  deliverable_summary: string;
  pricing_kind: "package" | "platform";
  platform: string | null;
};

export type CreatorQuotationPriceSegment = {
  kind: "package" | "platform";
  platform: string | null;
  platform_label: string;
  quote_count: number;
  avg_cost: number;
  avg_cost_egp: number;
  avg_cost_currency: string;
};

export type CreatorQuotationPriceReference = {
  influencer_id: string;
  quote_count: number;
  avg_cost_egp: number;
  avg_cost: number;
  avg_cost_currency: string;
  last_quoted_at: string | null;
  recent_quotes: CreatorQuotationPriceEntry[];
  segments: CreatorQuotationPriceSegment[];
};

type QuotationItemPriceRow = {
  influencer_id: string | null;
  quotation_id: string;
  cost: number;
  cost_currency: string;
  cost_egp: number;
  deliverables: unknown;
  created_at: string;
  quotations: {
    serial_number: string | null;
    name: string;
    is_archived: boolean;
  } | null;
};

const RECENT_QUOTE_LIMIT = 5;

const PACKAGE_POST_TYPES = new Set([
  "cross_posting",
  "mirrored_on_all_pf",
  "all_platforms",
  "campaign_series",
]);

const PLATFORM_SEGMENT_ORDER = ["instagram", "tiktok", "youtube", "snapchat", "facebook"];

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolveQuotePlatformsFromDeliverables(deliverables: unknown): string[] {
  if (!Array.isArray(deliverables) || deliverables.length === 0) return [];

  const platforms = new Set<string>();
  for (const raw of deliverables) {
    if (!raw || typeof raw !== "object") continue;
    const deliverable = raw as {
      platform?: string | null;
      type?: string | null;
      types?: string[] | null;
      type_lines?: Array<{ type?: string; quantity?: number }> | null;
    };

    const platformField = deliverable.platform?.trim();
    if (platformField) {
      for (const part of platformField.split(",")) {
        const key = canonicalPlatformKey(part.trim());
        if (key) platforms.add(key);
      }
    }

    for (const platform of platformsFromSelectedPostTypes(deliverableTypeValues(deliverable), [])) {
      platforms.add(platform);
    }
  }

  return [...platforms].sort(
    (a, b) => PLATFORM_SEGMENT_ORDER.indexOf(a) - PLATFORM_SEGMENT_ORDER.indexOf(b)
  );
}

function isPackageQuote(deliverables: unknown, platforms: string[]): boolean {
  if (platforms.length >= 2) return true;
  if (!Array.isArray(deliverables)) return false;

  for (const raw of deliverables) {
    if (!raw || typeof raw !== "object") continue;
    const deliverable = raw as {
      type?: string | null;
      types?: string[] | null;
      type_lines?: Array<{ type?: string; quantity?: number }> | null;
    };
    if (typeLinesIncludeAllPlatforms(deliverable)) return true;
    if (deliverableTypeValues(deliverable).some((type) => PACKAGE_POST_TYPES.has(type))) {
      return true;
    }
  }

  return false;
}

function classifyQuotationPricing(
  deliverables: unknown
): { kind: "package" | "platform"; platform: string | null } {
  const platforms = resolveQuotePlatformsFromDeliverables(deliverables);
  if (isPackageQuote(deliverables, platforms)) {
    return { kind: "package", platform: null };
  }
  return { kind: "platform", platform: platforms[0] ?? null };
}

function segmentKeyForPricing(pricing: {
  kind: "package" | "platform";
  platform: string | null;
}): string {
  return pricing.kind === "package" ? "package" : `platform:${pricing.platform ?? "unknown"}`;
}

function segmentLabelForPricing(pricing: {
  kind: "package" | "platform";
  platform: string | null;
}): string {
  if (pricing.kind === "package") return "Package";
  if (!pricing.platform) return "Quoted line";
  return platformLabel(pricing.platform);
}

function computeSegmentAverages(
  rows: QuotationItemPriceRow[]
): Pick<
  CreatorQuotationPriceSegment,
  "avg_cost" | "avg_cost_egp" | "avg_cost_currency" | "quote_count"
> {
  const quoteCount = rows.length;
  const avgCostEgp =
    rows.reduce((sum, row) => sum + Number(row.cost_egp ?? 0), 0) / quoteCount;

  const currencyCounts = new Map<string, number>();
  for (const row of rows) {
    const currency = row.cost_currency?.toUpperCase() ?? "EGP";
    currencyCounts.set(currency, (currencyCounts.get(currency) ?? 0) + 1);
  }
  const dominantCurrency = [...currencyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "EGP";

  const sameCurrencyRows = rows.filter(
    (row) => (row.cost_currency?.toUpperCase() ?? "EGP") === dominantCurrency
  );
  const avgCost =
    sameCurrencyRows.length > 0
      ? sameCurrencyRows.reduce((sum, row) => sum + Number(row.cost), 0) / sameCurrencyRows.length
      : avgCostEgp;

  return {
    quote_count: quoteCount,
    avg_cost: roundMoney(avgCost),
    avg_cost_egp: roundMoney(avgCostEgp),
    avg_cost_currency: dominantCurrency,
  };
}

function buildQuotationPriceSegments(
  rows: QuotationItemPriceRow[]
): CreatorQuotationPriceSegment[] {
  const grouped = new Map<string, { pricing: ReturnType<typeof classifyQuotationPricing>; rows: QuotationItemPriceRow[] }>();

  for (const row of rows) {
    const pricing = classifyQuotationPricing(row.deliverables);
    const key = segmentKeyForPricing(pricing);
    const existing = grouped.get(key);
    if (existing) {
      existing.rows.push(row);
      continue;
    }
    grouped.set(key, { pricing, rows: [row] });
  }

  const segments = [...grouped.values()].map(({ pricing, rows: segmentRows }) => ({
    kind: pricing.kind,
    platform: pricing.platform,
    platform_label: segmentLabelForPricing(pricing),
    ...computeSegmentAverages(segmentRows),
  }));

  return segments.sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === "package" ? -1 : 1;
    if (left.kind === "package") return 0;
    const leftIndex = PLATFORM_SEGMENT_ORDER.indexOf(left.platform ?? "");
    const rightIndex = PLATFORM_SEGMENT_ORDER.indexOf(right.platform ?? "");
    return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
  });
}

function formatAverageAmount(amount: number, currency: string): string {
  return formatMoneyKpi(amount, currency);
}

function formatQuoteCountLabel(quoteCount: number): string {
  return quoteCount === 1 ? "1 quote" : `${quoteCount} quotes`;
}

function deliverableSummary(deliverables: unknown): string {
  if (!Array.isArray(deliverables) || deliverables.length === 0) {
    return "Quoted line";
  }
  return formatQuotationDeliverablesSummary(
    deliverables as Parameters<typeof formatQuotationDeliverablesSummary>[0]
  );
}

export function aggregateQuotationPriceReference(
  influencerId: string,
  rows: QuotationItemPriceRow[]
): CreatorQuotationPriceReference | null {
  const priced = rows.filter((row) => row.influencer_id === influencerId && Number(row.cost) > 0);
  if (priced.length === 0) return null;

  const quoteCount = priced.length;
  const avgCostEgp =
    priced.reduce((sum, row) => sum + Number(row.cost_egp ?? 0), 0) / quoteCount;

  const currencyCounts = new Map<string, number>();
  for (const row of priced) {
    const currency = row.cost_currency?.toUpperCase() ?? "EGP";
    currencyCounts.set(currency, (currencyCounts.get(currency) ?? 0) + 1);
  }
  const dominantCurrency = [...currencyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "EGP";

  const sameCurrencyRows = priced.filter(
    (row) => (row.cost_currency?.toUpperCase() ?? "EGP") === dominantCurrency
  );
  const avgCost =
    sameCurrencyRows.length > 0
      ? sameCurrencyRows.reduce((sum, row) => sum + Number(row.cost), 0) / sameCurrencyRows.length
      : avgCostEgp;

  const recentQuotes: CreatorQuotationPriceEntry[] = [...priced]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, RECENT_QUOTE_LIMIT)
    .map((row) => {
      const pricing = classifyQuotationPricing(row.deliverables);
      return {
        quotation_id: row.quotation_id,
        quotation_serial: row.quotations?.serial_number ?? null,
        quotation_name: row.quotations?.name ?? null,
        cost: Number(row.cost),
        cost_currency: row.cost_currency,
        cost_egp: Number(row.cost_egp ?? 0),
        quoted_at: row.created_at,
        deliverable_summary: deliverableSummary(row.deliverables),
        pricing_kind: pricing.kind,
        platform: pricing.platform,
      };
    });

  const segments = buildQuotationPriceSegments(priced);

  return {
    influencer_id: influencerId,
    quote_count: quoteCount,
    avg_cost_egp: roundMoney(avgCostEgp),
    avg_cost: roundMoney(avgCost),
    avg_cost_currency: dominantCurrency,
    last_quoted_at: recentQuotes[0]?.quoted_at ?? null,
    recent_quotes: recentQuotes,
    segments,
  };
}

function groupRowsByInfluencer(rows: QuotationItemPriceRow[]): Map<string, QuotationItemPriceRow[]> {
  const grouped = new Map<string, QuotationItemPriceRow[]>();
  for (const row of rows) {
    if (!row.influencer_id) continue;
    const existing = grouped.get(row.influencer_id) ?? [];
    existing.push(row);
    grouped.set(row.influencer_id, existing);
  }
  return grouped;
}

export async function fetchQuotationItemPriceRows(
  supabase: SupabaseClient<Database>,
  influencerIds: string[]
): Promise<QuotationItemPriceRow[]> {
  if (influencerIds.length === 0) return [];

  const { data, error } = await supabase
    .from("quotation_items")
    .select(
      `
      influencer_id,
      quotation_id,
      cost,
      cost_currency,
      cost_egp,
      deliverables,
      created_at,
      quotations!inner(serial_number, name, is_archived)
    `
    )
    .in("influencer_id", influencerIds)
    .gt("cost", 0)
    .eq("quotations.is_archived", false)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as QuotationItemPriceRow[];
}

export async function getQuotationPriceReferenceForInfluencer(
  supabase: SupabaseClient<Database>,
  influencerId: string
): Promise<CreatorQuotationPriceReference | null> {
  const rows = await fetchQuotationItemPriceRows(supabase, [influencerId]);
  return aggregateQuotationPriceReference(influencerId, rows);
}

/** Full quotation line history for Commercial CRM Quotations tab. */
export async function listQuotationHistoryForInfluencer(
  supabase: SupabaseClient<Database>,
  influencerId: string,
  limit = 50
): Promise<CreatorQuotationPriceEntry[]> {
  const rows = await fetchQuotationItemPriceRows(supabase, [influencerId]);
  return [...rows]
    .filter((row) => row.influencer_id === influencerId && Number(row.cost) > 0)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
    .map((row) => {
      const pricing = classifyQuotationPricing(row.deliverables);
      return {
        quotation_id: row.quotation_id,
        quotation_serial: row.quotations?.serial_number ?? null,
        quotation_name: row.quotations?.name ?? null,
        cost: Number(row.cost),
        cost_currency: row.cost_currency,
        cost_egp: Number(row.cost_egp ?? 0),
        quoted_at: row.created_at,
        deliverable_summary: deliverableSummary(row.deliverables),
        pricing_kind: pricing.kind,
        platform: pricing.platform,
      };
    });
}

export async function getQuotationPriceReferencesBatch(
  supabase: SupabaseClient<Database>,
  influencerIds: string[]
): Promise<Map<string, CreatorQuotationPriceReference>> {
  const uniqueIds = [...new Set(influencerIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const rows = await fetchQuotationItemPriceRows(supabase, uniqueIds);
  const grouped = groupRowsByInfluencer(rows);
  const result = new Map<string, CreatorQuotationPriceReference>();

  for (const influencerId of uniqueIds) {
    const reference = aggregateQuotationPriceReference(influencerId, grouped.get(influencerId) ?? []);
    if (reference) result.set(influencerId, reference);
  }

  return result;
}

export function formatQuotationPriceSegmentLabel(
  segment: CreatorQuotationPriceSegment,
  currency?: string
): string {
  const displayCurrency = currency ?? segment.avg_cost_currency;
  const amount =
    displayCurrency === segment.avg_cost_currency ? segment.avg_cost : segment.avg_cost_egp;
  return `${formatAverageAmount(amount, displayCurrency)} avg · ${formatQuoteCountLabel(segment.quote_count)}`;
}

export function formatQuotationPriceSegmentHeadline(segment: CreatorQuotationPriceSegment): string {
  return `${segment.platform_label} · ${formatQuotationPriceSegmentLabel(segment)}`;
}

export function formatQuotationPriceReferenceLabel(
  reference: CreatorQuotationPriceReference,
  currency?: string
): string {
  if (reference.segments.length === 1) {
    return formatQuotationPriceSegmentHeadline(reference.segments[0]!);
  }

  const displayCurrency = currency ?? reference.avg_cost_currency;
  const amount =
    displayCurrency === reference.avg_cost_currency
      ? reference.avg_cost
      : reference.avg_cost_egp;
  return `${formatAverageAmount(amount, displayCurrency)} avg · ${formatQuoteCountLabel(reference.quote_count)}`;
}
