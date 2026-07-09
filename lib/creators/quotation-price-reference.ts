import type { SupabaseClient } from "@supabase/supabase-js";

import { formatQuotationDeliverablesSummary } from "@/lib/quotations/quotation-deliverable-types";
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
};

export type CreatorQuotationPriceReference = {
  influencer_id: string;
  quote_count: number;
  avg_cost_egp: number;
  avg_cost: number;
  avg_cost_currency: string;
  last_quoted_at: string | null;
  recent_quotes: CreatorQuotationPriceEntry[];
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

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
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
    .map((row) => ({
      quotation_id: row.quotation_id,
      quotation_serial: row.quotations?.serial_number ?? null,
      quotation_name: row.quotations?.name ?? null,
      cost: Number(row.cost),
      cost_currency: row.cost_currency,
      cost_egp: Number(row.cost_egp ?? 0),
      quoted_at: row.created_at,
      deliverable_summary: deliverableSummary(row.deliverables),
    }));

  return {
    influencer_id: influencerId,
    quote_count: quoteCount,
    avg_cost_egp: roundMoney(avgCostEgp),
    avg_cost: roundMoney(avgCost),
    avg_cost_currency: dominantCurrency,
    last_quoted_at: recentQuotes[0]?.quoted_at ?? null,
    recent_quotes: recentQuotes,
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

async function fetchQuotationItemPriceRows(
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

export function formatQuotationPriceReferenceLabel(
  reference: CreatorQuotationPriceReference,
  currency?: string
): string {
  const displayCurrency = currency ?? reference.avg_cost_currency;
  const amount =
    displayCurrency === reference.avg_cost_currency
      ? reference.avg_cost
      : reference.avg_cost_egp;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: displayCurrency,
    maximumFractionDigits: 0,
  }).format(amount);

  const countLabel = reference.quote_count === 1 ? "1 quote" : `${reference.quote_count} quotes`;
  return `${formatted} avg · ${countLabel}`;
}
