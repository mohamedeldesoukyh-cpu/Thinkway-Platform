import type { SupabaseClient } from "@supabase/supabase-js";

import {
  computeAgencyFeeAmount,
  rollupLineClientCommercial,
} from "@/lib/assignments/client-billing-commercial";
import { roundMoney } from "@/lib/analytics/aggregations/round";
import { parseClientTypeFilter } from "@/lib/analytics/filters/client-type-filter";
import {
  convertPnlFactsToDisplayCurrency,
  normalizePnlDisplayCurrency,
  PNL_FALLBACK_DISPLAY_CURRENCIES,
} from "@/lib/analytics/pnl/pnl-currency";
import type { PnlLineFact } from "@/lib/analytics/pnl/pnl-report-types";
import {
  parsePnlPeriodScope,
  parsePnlYear,
  type PnlPeriodScope,
} from "@/lib/analytics/pnl/pnl-periods";
import {
  applyVrRefundToLineCommercial,
  resolveCampaignVrRatePercent,
} from "@/lib/analytics/pnl/vr-refund";
import { buildTopInfluencersReport } from "@/lib/analytics/top-influencers/build-top-influencers-report";
import type { TopInfluencersClientMeta } from "@/lib/analytics/top-influencers/build-top-influencers-report";
import type { InfluencerSpendFact } from "@/lib/analytics/top-influencers/influencer-spend-fact";
import type {
  TopInfluencersClientTypeFilter,
  TopInfluencersMetric,
  TopInfluencersReportData,
} from "@/lib/analytics/top-influencers/top-influencers-types";
import {
  TOP_INFLUENCERS_DEFAULT_LIMIT,
  TOP_INFLUENCERS_MAX_LIMIT,
  TOP_INFLUENCERS_MIN_LIMIT,
} from "@/lib/analytics/top-influencers/top-influencers-types";
import { parseLineAssignment } from "@/features/campaigns/line-assignment";
import { resolveEffectiveExchangeRate } from "@/features/finance/exchange-rates/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AgencyOrDirect, CampaignStatus } from "@/types/database";

const PNL_ACTUAL_CAMPAIGN_STATUSES: CampaignStatus[] = ["active", "paused", "completed"];
const PNL_EXCLUDED_LINE_STATUSES: CampaignStatus[] = ["cancelled"];

function resolveLineCommercial(line: {
  revenue: number;
  cost: number;
  profit: number;
  revenue_before_vat?: number | null;
  usage_rights_amount?: number | null;
  usage_rights_cost?: number | null;
  agency_fee_percent?: number | null;
  agency_fee_amount?: number | null;
  cost_before_vat?: number | null;
}): {
  revenue: number;
  ur_rev: number;
  agency_fees: number;
  cost: number;
  gp: number;
} {
  const revenueBeforeVat = Number(line.revenue_before_vat ?? line.revenue ?? 0);
  const usageRightsAmount = Number(line.usage_rights_amount ?? 0);
  const usageRightsCost = Number(line.usage_rights_cost ?? 0);
  const costBeforeVat = Number(line.cost_before_vat ?? line.cost ?? 0);
  const commercial = rollupLineClientCommercial({
    revenueBeforeVat,
    usageRightsAmount,
    usageRightsCost,
    agencyFeePercent: Number(line.agency_fee_percent ?? 0),
    agencyFeeAmount: line.agency_fee_amount,
    costBeforeVat,
  });
  const agencyFees =
    line.agency_fee_amount != null && Number(line.agency_fee_amount) > 0
      ? roundMoney(Number(line.agency_fee_amount))
      : computeAgencyFeeAmount(
          revenueBeforeVat,
          usageRightsAmount,
          Number(line.agency_fee_percent ?? 0)
        );

  return {
    revenue: commercial.revenueBeforeVat,
    ur_rev: usageRightsAmount,
    agency_fees: agencyFees,
    cost: roundMoney(costBeforeVat + usageRightsCost),
    gp: commercial.gp,
  };
}

function resolvePeriodMonth(header: {
  start_date: string | null;
  created_at?: string | null;
}): string | null {
  if (header.start_date) {
    return header.start_date.slice(0, 7);
  }
  if (header.created_at) {
    return header.created_at.slice(0, 7);
  }
  return null;
}

function buildAvailableCurrencies(facts: InfluencerSpendFact[]): string[] {
  const fromFacts = [
    ...new Set(
      facts
        .map((fact) => (fact.currency_code ?? "USD").trim().toUpperCase())
        .filter((code) => code.length === 3)
    ),
  ];
  return [...new Set([...PNL_FALLBACK_DISPLAY_CURRENCIES, ...fromFacts])].sort();
}

async function loadTopInfluencersClientMeta(
  supabase: SupabaseClient
): Promise<TopInfluencersClientMeta[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("id, agency_or_direct")
    .neq("status", "archived")
    .limit(5000);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    client_id: row.id,
    agency_or_direct: (row.agency_or_direct as AgencyOrDirect | null) ?? null,
  }));
}

export async function loadInfluencerSpendFacts(
  supabase: SupabaseClient
): Promise<InfluencerSpendFact[]> {
  const [linesResult, headersResult, vendorLinksResult, influencersResult] = await Promise.all([
    supabase
      .from("campaign_lines")
      .select(
        "id, campaign_header_id, status, revenue, cost, profit, revenue_before_vat, usage_rights_amount, usage_rights_cost, agency_fee_percent, agency_fee_amount, cost_before_vat, currency_code, metadata"
      )
      .limit(10000),
    supabase
      .from("campaign_headers")
      .select(
        `
        id, start_date, created_at, status,
        vr_rate:md_vr_rates(rate_percent),
        brand:brands(
          vr_rate:md_vr_rates(rate_percent)
        ),
        client:clients(
          id,
          name
        )
      `
      )
      .in("status", PNL_ACTUAL_CAMPAIGN_STATUSES)
      .limit(5000),
    supabase
      .from("campaign_influencers")
      .select("campaign_line_id, influencer_id")
      .not("campaign_line_id", "is", null)
      .limit(10000),
    supabase
      .from("influencers")
      .select("id, display_name, document_number")
      .neq("status", "archived")
      .limit(5000),
  ]);

  if (linesResult.error) throw new Error(linesResult.error.message);
  if (headersResult.error) throw new Error(headersResult.error.message);
  if (vendorLinksResult.error) throw new Error(vendorLinksResult.error.message);
  if (influencersResult.error) throw new Error(influencersResult.error.message);

  type HeaderRow = {
    id: string;
    start_date: string | null;
    created_at?: string | null;
    status: CampaignStatus;
    vr_rate: { rate_percent: number } | { rate_percent: number }[] | null;
    brand:
      | {
          vr_rate: { rate_percent: number } | { rate_percent: number }[] | null;
        }
      | {
          vr_rate: { rate_percent: number } | { rate_percent: number }[] | null;
        }[]
      | null;
    client:
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null;
  };

  type LineRow = {
    id: string;
    campaign_header_id: string;
    status?: CampaignStatus;
    revenue: number;
    cost: number;
    profit: number;
    revenue_before_vat?: number | null;
    usage_rights_amount?: number | null;
    usage_rights_cost?: number | null;
    agency_fee_percent?: number | null;
    agency_fee_amount?: number | null;
    cost_before_vat?: number | null;
    currency_code: string | null;
    metadata: Record<string, unknown> | null;
  };

  const headerMap = new Map<string, HeaderRow>();
  for (const header of (headersResult.data ?? []) as unknown as HeaderRow[]) {
    headerMap.set(header.id, header);
  }

  const influencerByLine = new Map<string, string>();
  for (const link of vendorLinksResult.data ?? []) {
    const row = link as { campaign_line_id: string | null; influencer_id: string };
    if (row.campaign_line_id) {
      influencerByLine.set(row.campaign_line_id, row.influencer_id);
    }
  }

  const influencerMeta = new Map<
    string,
    { display_name: string; document_number: string }
  >();
  for (const influencer of influencersResult.data ?? []) {
    influencerMeta.set(influencer.id, {
      display_name: influencer.display_name,
      document_number: influencer.document_number ?? "",
    });
  }

  const facts: InfluencerSpendFact[] = [];

  for (const line of (linesResult.data ?? []) as unknown as LineRow[]) {
    const header = headerMap.get(line.campaign_header_id);
    if (!header) continue;

    if (line.status && PNL_EXCLUDED_LINE_STATUSES.includes(line.status)) {
      continue;
    }

    const client = Array.isArray(header.client) ? header.client[0] : header.client;
    if (!client?.id) continue;

    const influencerId =
      influencerByLine.get(line.id) ??
      parseLineAssignment(line.metadata ?? undefined)?.influencer_id ??
      null;
    if (!influencerId) continue;

    const meta = influencerMeta.get(influencerId);
    const assignment = parseLineAssignment(line.metadata ?? undefined);

    const commercial = resolveLineCommercial(line);
    const brand = Array.isArray(header.brand) ? header.brand[0] : header.brand;
    const vrRatePercent = resolveCampaignVrRatePercent({
      headerVrRate: header.vr_rate,
      brandVrRate: brand?.vr_rate,
    });
    const vrAdjusted = applyVrRefundToLineCommercial({
      baseCost: commercial.cost,
      gp: commercial.gp,
      vrRatePercent,
    });

    facts.push({
      influencer_id: influencerId,
      influencer_name:
        meta?.display_name ??
        assignment?.influencer_name ??
        "Unknown vendor",
      document_number:
        meta?.document_number ??
        assignment?.influencer_document_number ??
        "",
      client_id: client.id,
      period_month: resolvePeriodMonth(header),
      spending: vrAdjusted.cost,
      revenue: commercial.revenue,
      ur_rev: commercial.ur_rev,
      agency_fees: commercial.agency_fees,
      gp: vrAdjusted.gp,
      gp_after_vr: vrAdjusted.gp_after_vr,
      currency_code: line.currency_code ?? "USD",
    });
  }

  return facts;
}

async function convertInfluencerFactsToDisplayCurrency(
  facts: InfluencerSpendFact[],
  displayCurrency: string,
  resolveRate: (fromCurrency: string, toCurrency: string) => Promise<number>
): Promise<InfluencerSpendFact[]> {
  const asPnlFacts: PnlLineFact[] = facts.map((fact) => ({
    client_id: fact.client_id,
    client_name: "",
    group_id: null,
    group_name: null,
    period_month: fact.period_month,
    revenue: fact.revenue,
    ur_rev: fact.ur_rev,
    agency_fees: fact.agency_fees,
    cost: fact.spending,
    gp: fact.gp,
    vr_refund: 0,
    gp_after_vr: fact.gp_after_vr,
    vr_rate_percent: 0,
    currency_code: fact.currency_code,
  }));

  const converted = await convertPnlFactsToDisplayCurrency(
    asPnlFacts,
    displayCurrency,
    resolveRate
  );

  return facts.map((fact, index) => {
    const convertedFact = converted[index];
    return {
      ...fact,
      spending: convertedFact.cost,
      revenue: convertedFact.revenue,
      ur_rev: convertedFact.ur_rev,
      agency_fees: convertedFact.agency_fees,
      gp: convertedFact.gp,
      gp_after_vr: convertedFact.gp_after_vr,
      currency_code: convertedFact.currency_code,
    };
  });
}

export type TopInfluencersReportQuery = {
  year?: number;
  period?: PnlPeriodScope;
  currency?: string;
  metric?: TopInfluencersMetric;
  limit?: number;
  clientType?: TopInfluencersClientTypeFilter;
};

export async function getTopInfluencersReport(
  query: TopInfluencersReportQuery = {}
): Promise<TopInfluencersReportData> {
  const supabase = await createSupabaseServerClient();
  const year = query.year ?? new Date().getFullYear();
  const periodScope = query.period ?? "fy";
  const metric = query.metric ?? "spending";
  const limit = query.limit ?? TOP_INFLUENCERS_DEFAULT_LIMIT;
  const clientType = query.clientType ?? "all";

  const [rawFacts, clients] = await Promise.all([
    loadInfluencerSpendFacts(supabase),
    loadTopInfluencersClientMeta(supabase),
  ]);

  const availableCurrencies = buildAvailableCurrencies(rawFacts);
  const displayCurrency = normalizePnlDisplayCurrency(query.currency, availableCurrencies);
  const facts = await convertInfluencerFactsToDisplayCurrency(
    rawFacts,
    displayCurrency,
    (fromCurrency, toCurrency) =>
      resolveEffectiveExchangeRate({ from_currency: fromCurrency, to_currency: toCurrency })
  );

  return buildTopInfluencersReport(
    facts,
    clients,
    year,
    periodScope,
    displayCurrency,
    availableCurrencies,
    metric,
    limit,
    clientType
  );
}

function parseTopInfluencersMetric(value: string | undefined): TopInfluencersMetric {
  if (value === "revenue" || value === "gp") return value;
  return "spending";
}

function parseTopInfluencersLimit(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return TOP_INFLUENCERS_DEFAULT_LIMIT;
  return Math.min(
    TOP_INFLUENCERS_MAX_LIMIT,
    Math.max(TOP_INFLUENCERS_MIN_LIMIT, Math.round(parsed))
  );
}

export function parseTopInfluencersSearchParams(
  params: Record<string, string | string[] | undefined>
): TopInfluencersReportQuery {
  const read = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const currentYear = new Date().getFullYear();
  const year = parsePnlYear(read("year"), currentYear);
  const currencyRaw = read("currency");

  return {
    year,
    period: parsePnlPeriodScope(read("period")),
    currency: currencyRaw?.trim().toUpperCase(),
    metric: parseTopInfluencersMetric(read("metric")),
    limit: parseTopInfluencersLimit(read("limit")),
    clientType: parseClientTypeFilter(read("clientType")),
  };
}
