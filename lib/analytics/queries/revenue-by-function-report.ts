import type { SupabaseClient } from "@supabase/supabase-js";

import {
  computeAgencyFeeAmount,
  rollupLineClientCommercial,
} from "@/lib/assignments/client-billing-commercial";
import { roundMoney } from "@/lib/analytics/aggregations/round";
import {
  clientTypeFilterLabel,
  loadClientAgencyOrDirectMap,
  parseClientTypeFilter,
  type ClientTypeFilter,
} from "@/lib/analytics/filters/client-type-filter";
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
import { buildRevenueByFunctionReport } from "@/lib/analytics/revenue-by-function/build-revenue-by-function-report";
import type {
  RevenueByFunctionFilter,
  RevenueByFunctionLineFact,
  RevenueByFunctionReportData,
  RevenueByFunctionUserOption,
} from "@/lib/analytics/revenue-by-function/revenue-by-function-types";
import { resolveEffectiveExchangeRate } from "@/features/finance/exchange-rates/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BusinessFunction, CampaignStatus } from "@/types/database";

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

export async function loadRevenueByFunctionLineFacts(
  supabase: SupabaseClient
): Promise<RevenueByFunctionLineFact[]> {
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
        id, start_date, created_at, status, account_manager_id,
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
        ),
        account_manager:profiles!campaign_headers_account_manager_id_fkey(
          id,
          full_name,
          email,
          business_function
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
    status: CampaignStatus;
    account_manager_id: string | null;
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
    account_manager:
      | {
          id: string;
          full_name: string | null;
          email: string;
          business_function: BusinessFunction | null;
        }
      | {
          id: string;
          full_name: string | null;
          email: string;
          business_function: BusinessFunction | null;
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

  const facts: RevenueByFunctionLineFact[] = [];

  for (const line of (linesResult.data ?? []) as unknown as LineRow[]) {
    const header = headerMap.get(line.campaign_header_id);
    if (!header) continue;

    if (line.status && PNL_EXCLUDED_LINE_STATUSES.includes(line.status)) {
      continue;
    }

    const client = Array.isArray(header.client) ? header.client[0] : header.client;
    if (!client?.id) continue;

    const accountManager = Array.isArray(header.account_manager)
      ? header.account_manager[0]
      : header.account_manager;

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
      period_month: resolvePeriodMonth(header),
      revenue: commercial.revenue,
      ur_rev: commercial.ur_rev,
      agency_fees: commercial.agency_fees,
      gp_after_vr: vrAdjusted.gp_after_vr,
      currency_code: line.currency_code ?? "USD",
      account_manager_id: header.account_manager_id,
      account_manager_name:
        accountManager?.full_name ?? accountManager?.email ?? null,
      business_function: accountManager?.business_function ?? null,
    });
  }

  return facts;
}

async function loadRevenueByFunctionUserOptions(
  supabase: SupabaseClient
): Promise<RevenueByFunctionUserOption[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, business_function, is_active")
    .eq("is_active", true)
    .order("full_name")
    .limit(500);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.full_name ?? row.email,
    business_function: (row.business_function as BusinessFunction | null) ?? null,
  }));
}

function buildAvailableCurrencies(facts: RevenueByFunctionLineFact[]): string[] {
  const fromFacts = [
    ...new Set(
      facts
        .map((fact) => (fact.currency_code ?? "USD").trim().toUpperCase())
        .filter((code) => code.length === 3)
    ),
  ];
  return [...new Set([...PNL_FALLBACK_DISPLAY_CURRENCIES, ...fromFacts])].sort();
}

async function convertRevenueByFunctionFactsToDisplayCurrency(
  facts: RevenueByFunctionLineFact[],
  displayCurrency: string,
  resolveRate: (fromCurrency: string, toCurrency: string) => Promise<number>
): Promise<RevenueByFunctionLineFact[]> {
  const converted = await convertPnlFactsToDisplayCurrency(
    facts.map((fact) => ({
      client_id: fact.client_id,
      client_name: fact.client_name,
      group_id: null,
      group_name: null,
      period_month: fact.period_month,
      revenue: fact.revenue,
      ur_rev: fact.ur_rev,
      agency_fees: fact.agency_fees,
      cost: 0,
      gp: 0,
      vr_refund: 0,
      gp_after_vr: fact.gp_after_vr,
      vr_rate_percent: 0,
      currency_code: fact.currency_code,
    })),
    displayCurrency,
    resolveRate
  );

  return converted.map((fact, index) => ({
    ...facts[index],
    revenue: fact.revenue,
    ur_rev: fact.ur_rev,
    agency_fees: fact.agency_fees,
    gp_after_vr: fact.gp_after_vr,
    currency_code: displayCurrency,
  }));
}

export type RevenueByFunctionReportQuery = {
  year?: number;
  period?: PnlPeriodScope;
  currency?: string;
  function?: RevenueByFunctionFilter;
  userId?: string;
  clientType?: ClientTypeFilter;
};

export async function getRevenueByFunctionReport(
  query: RevenueByFunctionReportQuery = {}
): Promise<RevenueByFunctionReportData> {
  const supabase = await createSupabaseServerClient();
  const year = query.year ?? new Date().getFullYear();
  const periodScope = query.period ?? "fy";
  const functionFilter = query.function ?? "all";
  const userFilter = query.userId ?? "all";
  const clientType = query.clientType ?? "all";

  const [rawFacts, agencyByClient, userOptions] = await Promise.all([
    loadRevenueByFunctionLineFacts(supabase),
    loadClientAgencyOrDirectMap(supabase),
    loadRevenueByFunctionUserOptions(supabase),
  ]);

  const availableCurrencies = buildAvailableCurrencies(rawFacts);
  const displayCurrency = normalizePnlDisplayCurrency(query.currency, availableCurrencies);
  const lineFacts = await convertRevenueByFunctionFactsToDisplayCurrency(
    rawFacts,
    displayCurrency,
    (fromCurrency, toCurrency) =>
      resolveEffectiveExchangeRate({ from_currency: fromCurrency, to_currency: toCurrency })
  );

  const report = buildRevenueByFunctionReport(
    lineFacts,
    agencyByClient,
    userOptions,
    year,
    periodScope,
    displayCurrency,
    availableCurrencies,
    functionFilter,
    userFilter,
    clientType
  );

  return {
    ...report,
    client_type_label: clientTypeFilterLabel(clientType),
  };
}

function parseRevenueByFunctionFilter(
  value: string | undefined
): RevenueByFunctionFilter {
  if (value === "ops" || value === "sales") return value;
  return "all";
}

export function parseRevenueByFunctionSearchParams(
  params: Record<string, string | string[] | undefined>
): RevenueByFunctionReportQuery {
  const read = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const currentYear = new Date().getFullYear();
  const year = parsePnlYear(read("year"), currentYear);
  const currencyRaw = read("currency");
  const userRaw = read("user");

  return {
    year,
    period: parsePnlPeriodScope(read("period")),
    currency: currencyRaw?.trim().toUpperCase(),
    function: parseRevenueByFunctionFilter(read("function")),
    userId: userRaw?.trim() || "all",
    clientType: parseClientTypeFilter(read("clientType")),
  };
}
