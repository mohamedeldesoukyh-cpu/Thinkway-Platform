import type { SupabaseClient } from "@supabase/supabase-js";

import { roundMoney } from "@/lib/analytics/aggregations/round";
import {
  convertPnlFactsToDisplayCurrency,
  normalizePnlDisplayCurrency,
  PNL_FALLBACK_DISPLAY_CURRENCIES,
} from "@/lib/analytics/pnl/pnl-currency";
import {
  parsePnlPeriodScope,
  parsePnlYear,
  type PnlPeriodScope,
} from "@/lib/analytics/pnl/pnl-periods";
import {
  applyVrRefundToLineCommercial,
  resolveCampaignVrRatePercent,
} from "@/lib/analytics/pnl/vr-refund";
import { buildSpendingByCategoryReport } from "@/lib/analytics/spending-by-category/build-spending-by-category-report";
import type {
  SpendingByCategoryGroupBy,
  SpendingByCategoryLineFact,
  SpendingByCategoryReportData,
  SpendingByCategoryView,
} from "@/lib/analytics/spending-by-category/spending-by-category-types";
import {
  computeAgencyFeeAmount,
  rollupLineClientCommercial,
} from "@/lib/assignments/client-billing-commercial";
import { resolveEffectiveExchangeRate } from "@/lib/finance/exchange-rates/resolve-rate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CampaignStatus } from "@/types/database";

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

export async function loadSpendingByCategoryLineFacts(
  supabase: SupabaseClient
): Promise<SpendingByCategoryLineFact[]> {
  const [linesResult, headersResult] = await Promise.all([
    supabase
      .from("campaign_lines")
      .select(
        "id, campaign_header_id, status, revenue, cost, profit, revenue_before_vat, usage_rights_amount, usage_rights_cost, agency_fee_percent, agency_fee_amount, cost_before_vat, currency_code"
      )
      .limit(10000),
    supabase
      .from("campaign_headers")
      .select(
        `
        id, document_number, name, start_date, created_at, status,
        vr_rate:md_vr_rates(rate_percent),
        brand:brands(
          id,
          name,
          vr_rate_id,
          vr_rate:md_vr_rates(rate_percent)
        ),
        client:clients(
          id,
          name,
          client_category,
          client_subcategory,
          vr_rate_id,
          vr_rate:md_vr_rates(rate_percent)
        )
      `
      )
      .in("status", PNL_ACTUAL_CAMPAIGN_STATUSES)
      .limit(5000),
  ]);

  if (linesResult.error) throw new Error(linesResult.error.message);
  if (headersResult.error) throw new Error(headersResult.error.message);

  type HeaderRow = {
    id: string;
    document_number: string | null;
    name: string | null;
    start_date: string | null;
    created_at?: string | null;
    status: CampaignStatus;
    vr_rate: { rate_percent: number } | { rate_percent: number }[] | null;
    brand:
      | {
          id: string;
          name: string;
          vr_rate_id: string | null;
          vr_rate: { rate_percent: number } | { rate_percent: number }[] | null;
        }
      | {
          id: string;
          name: string;
          vr_rate_id: string | null;
          vr_rate: { rate_percent: number } | { rate_percent: number }[] | null;
        }[]
      | null;
    client:
      | {
          id: string;
          name: string;
          client_category: string | null;
          client_subcategory: string | null;
          vr_rate_id: string | null;
          vr_rate: { rate_percent: number } | { rate_percent: number }[] | null;
        }
      | {
          id: string;
          name: string;
          client_category: string | null;
          client_subcategory: string | null;
          vr_rate_id: string | null;
          vr_rate: { rate_percent: number } | { rate_percent: number }[] | null;
        }[]
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
  };

  const headerMap = new Map<string, HeaderRow>();
  for (const header of (headersResult.data ?? []) as unknown as HeaderRow[]) {
    headerMap.set(header.id, header);
  }

  const facts: SpendingByCategoryLineFact[] = [];

  for (const line of (linesResult.data ?? []) as unknown as LineRow[]) {
    const header = headerMap.get(line.campaign_header_id);
    if (!header) continue;

    if (line.status && PNL_EXCLUDED_LINE_STATUSES.includes(line.status)) {
      continue;
    }

    const client = Array.isArray(header.client) ? header.client[0] : header.client;
    if (!client?.id) continue;

    const brand = Array.isArray(header.brand) ? header.brand[0] : header.brand;
    const commercial = resolveLineCommercial(line);
    const billableRevenue = roundMoney(
      commercial.revenue + commercial.ur_rev + commercial.agency_fees
    );

    const vrRatePercent = resolveCampaignVrRatePercent({
      headerVrRate: header.vr_rate,
      brandVrRateId: brand?.vr_rate_id,
      brandVrRate: brand?.vr_rate,
      clientVrRate: client?.vr_rate,
    });
    const vrAdjusted = applyVrRefundToLineCommercial({
      baseCost: commercial.cost,
      gp: commercial.gp,
      vrRatePercent,
    });

    facts.push({
      client_id: client.id,
      client_name: client.name,
      client_category: client.client_category,
      client_subcategory: client.client_subcategory,
      brand_id: brand?.id ?? null,
      brand_name: brand?.name ?? null,
      campaign_header_id: header.id,
      campaign_code: header.document_number,
      campaign_name: header.name,
      period_month: resolvePeriodMonth(header),
      billable_revenue: billableRevenue,
      vr_refund: vrAdjusted.vr_refund,
      gp_after_vr: vrAdjusted.gp_after_vr,
      currency_code: line.currency_code ?? "USD",
    });
  }

  return facts;
}

function buildAvailableCurrencies(facts: SpendingByCategoryLineFact[]): string[] {
  const fromFacts = [
    ...new Set(
      facts
        .map((fact) => (fact.currency_code ?? "USD").trim().toUpperCase())
        .filter((code) => code.length === 3)
    ),
  ];
  return [...new Set([...PNL_FALLBACK_DISPLAY_CURRENCIES, ...fromFacts])].sort();
}

function detectMixedCurrencies(facts: SpendingByCategoryLineFact[]): {
  hasMixed: boolean;
  codes: string[];
} {
  const codes = [
    ...new Set(
      facts
        .map((fact) => (fact.currency_code ?? "USD").trim().toUpperCase())
        .filter((code) => code.length === 3)
    ),
  ].sort();
  return {
    hasMixed: codes.length > 1,
    codes,
  };
}

async function convertSpendingFactsToDisplayCurrency(
  facts: SpendingByCategoryLineFact[],
  displayCurrency: string,
  resolveRate: (fromCurrency: string, toCurrency: string) => Promise<number>
): Promise<SpendingByCategoryLineFact[]> {
  const converted = await convertPnlFactsToDisplayCurrency(
    facts.map((fact) => ({
      client_id: fact.client_id,
      client_name: fact.client_name,
      group_id: null,
      group_name: null,
      period_month: fact.period_month,
      revenue: fact.billable_revenue,
      ur_rev: 0,
      agency_fees: 0,
      cost: 0,
      gp: 0,
      vr_refund: fact.vr_refund,
      gp_after_vr: fact.gp_after_vr,
      vr_rate_percent: 0,
      currency_code: fact.currency_code,
    })),
    displayCurrency,
    resolveRate
  );

  return converted.map((fact, index) => ({
    ...facts[index],
    billable_revenue: fact.revenue,
    vr_refund: fact.vr_refund,
    gp_after_vr: fact.gp_after_vr,
    currency_code: displayCurrency,
  }));
}

export type SpendingByCategoryReportQuery = {
  year?: number;
  period?: PnlPeriodScope;
  currency?: string;
  groupBy?: SpendingByCategoryGroupBy;
  view?: SpendingByCategoryView;
};

function parseGroupBy(value: string | undefined): SpendingByCategoryGroupBy {
  return value === "subcategory" ? "subcategory" : "category";
}

function parseView(value: string | undefined): SpendingByCategoryView {
  return value === "analysis" ? "analysis" : "summary";
}

export async function getSpendingByCategoryReport(
  query: SpendingByCategoryReportQuery = {}
): Promise<SpendingByCategoryReportData> {
  const supabase = await createSupabaseServerClient();
  const year = query.year ?? new Date().getFullYear();
  const periodScope = query.period ?? "fy";
  const groupBy = query.groupBy ?? "category";
  const view = query.view ?? "summary";

  const rawFacts = await loadSpendingByCategoryLineFacts(supabase);
  const { hasMixed, codes } = detectMixedCurrencies(rawFacts);
  const availableCurrencies = buildAvailableCurrencies(rawFacts);
  const displayCurrency = normalizePnlDisplayCurrency(query.currency, availableCurrencies);
  const lineFacts = await convertSpendingFactsToDisplayCurrency(
    rawFacts,
    displayCurrency,
    (fromCurrency, toCurrency) =>
      resolveEffectiveExchangeRate({ from_currency: fromCurrency, to_currency: toCurrency })
  );

  return buildSpendingByCategoryReport(
    lineFacts,
    year,
    periodScope,
    displayCurrency,
    availableCurrencies,
    groupBy,
    view,
    hasMixed,
    codes
  );
}

export function parseSpendingByCategorySearchParams(
  params: Record<string, string | string[] | undefined>
): SpendingByCategoryReportQuery {
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
    groupBy: parseGroupBy(read("groupBy")),
    view: parseView(read("view")),
  };
}
