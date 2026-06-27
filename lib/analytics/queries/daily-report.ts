import type { SupabaseClient } from "@supabase/supabase-js";

import { roundMoney } from "@/lib/analytics/aggregations/round";
import { buildDailyReport } from "@/lib/analytics/daily/build-daily-report";
import {
  buildDailyDrilldown,
  parseDailyDrilldownMetric,
  parseDailyDrilldownRowType,
} from "@/lib/analytics/daily/build-daily-drilldown";
import {
  parseDailyReportLayout,
  parseDailyReportMonth,
  parseDailyReportPeriod,
  parseDailyReportViewMode,
  parseDailyReportYear,
} from "@/lib/analytics/daily/daily-report-periods";
import type {
  DailyDrilldownData,
  DailyDrilldownQuery,
  DailyLineFact,
  DailyReportData,
  DailyReportQuery,
} from "@/lib/analytics/daily/daily-report-types";
import {
  computeAgencyFeeAmount,
  rollupLineClientCommercial,
} from "@/lib/assignments/client-billing-commercial";
import {
  normalizePnlDisplayCurrency,
  PNL_FALLBACK_DISPLAY_CURRENCIES,
} from "@/lib/analytics/pnl/pnl-currency";
import {
  applyVrRefundToLineCommercial,
  resolveCampaignVrRatePercent,
} from "@/lib/analytics/pnl/vr-refund";
import {
  filterFactsByClientType,
  loadClientAgencyOrDirectMap,
  parseClientTypeFilter,
  type ClientTypeFilter,
} from "@/lib/analytics/filters/client-type-filter";
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
}) {
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

function resolvePeriodDate(header: {
  start_date: string | null;
  created_at?: string | null;
}): string | null {
  if (header.start_date) {
    return header.start_date.slice(0, 10);
  }
  if (header.created_at) {
    return header.created_at.slice(0, 10);
  }
  return null;
}

async function loadDailyLineFacts(supabase: SupabaseClient): Promise<DailyLineFact[]> {
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
        id, start_date, created_at, status,
        vr_rate:md_vr_rates(rate_percent),
        brand:brands(
          vr_rate_id,
          vr_rate:md_vr_rates(rate_percent)
        ),
        client:clients(
          id,
          name,
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
    start_date: string | null;
    created_at?: string | null;
    vr_rate: { rate_percent: number } | { rate_percent: number }[] | null;
    brand:
      | {
          vr_rate_id: string | null;
          vr_rate: { rate_percent: number } | { rate_percent: number }[] | null;
        }
      | {
          vr_rate_id: string | null;
          vr_rate: { rate_percent: number } | { rate_percent: number }[] | null;
        }[]
      | null;
    client:
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

  const facts: DailyLineFact[] = [];

  for (const line of (linesResult.data ?? []) as unknown as LineRow[]) {
    const header = headerMap.get(line.campaign_header_id);
    if (!header) continue;

    if (line.status && PNL_EXCLUDED_LINE_STATUSES.includes(line.status)) {
      continue;
    }

    const periodDate = resolvePeriodDate(header);
    if (!periodDate) continue;

    const client = Array.isArray(header.client) ? header.client[0] : header.client;
    if (!client?.id) continue;

    const commercial = resolveLineCommercial(line);
    const brand = Array.isArray(header.brand) ? header.brand[0] : header.brand;
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
      period_date: periodDate,
      revenue: commercial.revenue,
      ur_rev: commercial.ur_rev,
      agency_fees: commercial.agency_fees,
      gp: vrAdjusted.gp,
      vr_refund: vrAdjusted.vr_refund,
      gp_after_vr: vrAdjusted.gp_after_vr,
      currency_code: line.currency_code ?? "USD",
    });
  }

  return facts;
}

function buildAvailableCurrencies(facts: DailyLineFact[]): string[] {
  const fromFacts = [
    ...new Set(
      facts
        .map((fact) => (fact.currency_code ?? "USD").trim().toUpperCase())
        .filter((code) => code.length === 3)
    ),
  ];
  return [...new Set([...PNL_FALLBACK_DISPLAY_CURRENCIES, ...fromFacts])].sort();
}

async function convertDailyFactsToDisplayCurrency(
  facts: DailyLineFact[],
  displayCurrency: string
): Promise<DailyLineFact[]> {
  const target = displayCurrency.toUpperCase();
  const sources = [
    ...new Set(facts.map((fact) => (fact.currency_code ?? "USD").trim().toUpperCase())),
  ];

  const rateBySource = new Map<string, number>();
  await Promise.all(
    sources.map(async (source) => {
      if (source === target) {
        rateBySource.set(source, 1);
        return;
      }
      const rate = await resolveEffectiveExchangeRate({
        from_currency: source,
        to_currency: target,
      });
      rateBySource.set(source, rate);
    })
  );

  return facts.map((fact) => {
    const source = (fact.currency_code ?? "USD").trim().toUpperCase();
    const rate = rateBySource.get(source) ?? 1;
    return {
      ...fact,
      revenue: roundMoney(fact.revenue * rate),
      ur_rev: roundMoney(fact.ur_rev * rate),
      agency_fees: roundMoney(fact.agency_fees * rate),
      gp: roundMoney(fact.gp * rate),
      vr_refund: roundMoney(fact.vr_refund * rate),
      gp_after_vr: roundMoney(fact.gp_after_vr * rate),
      currency_code: target,
    };
  });
}

export async function getDailyDrilldown(query: DailyDrilldownQuery): Promise<DailyDrilldownData> {
  const supabase = await createSupabaseServerClient();
  const clientType = query.clientType ?? "all";
  const [rawFacts, agencyByClient] = await Promise.all([
    loadDailyLineFacts(supabase),
    loadClientAgencyOrDirectMap(supabase),
  ]);
  const filteredFacts = filterFactsByClientType(rawFacts, agencyByClient, clientType);
  const availableCurrencies = buildAvailableCurrencies(filteredFacts);
  const displayCurrency = normalizePnlDisplayCurrency(query.currency, availableCurrencies);
  const facts = await convertDailyFactsToDisplayCurrency(filteredFacts, displayCurrency);

  return buildDailyDrilldown(facts, {
    ...query,
    currency: displayCurrency,
    clientType,
  });
}

export function parseDailyDrilldownSearchParams(
  params: Record<string, string | string[] | undefined>
): DailyDrilldownQuery | null {
  const read = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const monthKey = read("monthKey")?.trim();
  const rowType = parseDailyDrilldownRowType(read("rowType"));
  const metric = parseDailyDrilldownMetric(read("metric"));
  const date = read("date")?.trim();
  const currencyRaw = read("currency");

  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey) || !rowType || !metric) {
    return null;
  }

  if (rowType === "day" && (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
    return null;
  }

  return {
    monthKey,
    rowType,
    metric,
    date: rowType === "day" ? date : undefined,
    currency: currencyRaw?.trim().toUpperCase(),
    clientType: parseClientTypeFilter(read("clientType")),
  };
}

export async function getDailyReport(query: DailyReportQuery): Promise<DailyReportData> {
  const supabase = await createSupabaseServerClient();
  const clientType = query.clientType ?? "all";
  const [rawFacts, agencyByClient] = await Promise.all([
    loadDailyLineFacts(supabase),
    loadClientAgencyOrDirectMap(supabase),
  ]);
  const filteredFacts = filterFactsByClientType(rawFacts, agencyByClient, clientType);
  const availableCurrencies = buildAvailableCurrencies(filteredFacts);
  const displayCurrency = normalizePnlDisplayCurrency(query.currency, availableCurrencies);
  const facts = await convertDailyFactsToDisplayCurrency(filteredFacts, displayCurrency);

  return buildDailyReport(facts, query, displayCurrency, availableCurrencies, new Date(), clientType);
}

export function parseDailyReportSearchParams(
  params: Record<string, string | string[] | undefined>
): DailyReportQuery {
  const read = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const now = new Date();
  const year = parseDailyReportYear(read("year"), now.getFullYear());
  const viewMode = parseDailyReportViewMode(read("view"));
  const layout = parseDailyReportLayout(read("layout"));
  const month = parseDailyReportMonth(read("month"), now.getMonth() + 1);
  const period = parseDailyReportPeriod(read("period"));
  const currencyRaw = read("currency");

  return {
    year,
    viewMode,
    layout,
    month,
    period,
    currency: currencyRaw?.trim().toUpperCase(),
    clientType: parseClientTypeFilter(read("clientType")),
  };
}
