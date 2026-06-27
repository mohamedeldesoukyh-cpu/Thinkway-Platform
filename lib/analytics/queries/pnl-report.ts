import type { SupabaseClient } from "@supabase/supabase-js";

import {
  computeAgencyFeeAmount,
  rollupLineClientCommercial,
} from "@/lib/assignments/client-billing-commercial";
import { roundMoney } from "@/lib/analytics/aggregations/round";
import { buildPnLComparisonReport } from "@/lib/analytics/pnl/build-pnl-report";
import {
  convertPnlFactsToDisplayCurrency,
  normalizePnlDisplayCurrency,
  PNL_FALLBACK_DISPLAY_CURRENCIES,
} from "@/lib/analytics/pnl/pnl-currency";
import type { PnlComparisonReportData, PnlLineFact } from "@/lib/analytics/pnl/pnl-report-types";
import {
  parsePnlPeriodScope,
  parsePnlYear,
  type PnlPeriodScope,
} from "@/lib/analytics/pnl/pnl-periods";
import {
  applyVrRefundToLineCommercial,
  resolveCampaignVrRatePercent,
} from "@/lib/analytics/pnl/vr-refund";
import {
  clientTypeFilterLabel,
  filterFactsByClientType,
  loadClientAgencyOrDirectMap,
  parseClientTypeFilter,
  type ClientTypeFilter,
} from "@/lib/analytics/filters/client-type-filter";
import { resolveEffectiveExchangeRate } from "@/lib/finance/exchange-rates/resolve-rate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CampaignStatus } from "@/types/database";

/** Campaigns with real operational/commercial activity — excludes pipeline and voided work. */
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

export async function loadPnLLineFacts(supabase: SupabaseClient): Promise<PnlLineFact[]> {
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
          group_id,
          vr_rate_id,
          vr_rate:md_vr_rates(rate_percent),
          group:groups(name)
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
          group_id: string | null;
          vr_rate_id: string | null;
          vr_rate: { rate_percent: number } | { rate_percent: number }[] | null;
          group:
            | { name: string }
            | { name: string }[]
            | null;
        }
      | {
          id: string;
          name: string;
          group_id: string | null;
          vr_rate_id: string | null;
          vr_rate: { rate_percent: number } | { rate_percent: number }[] | null;
          group:
            | { name: string }
            | { name: string }[]
            | null;
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

  const facts: PnlLineFact[] = [];

  for (const line of (linesResult.data ?? []) as unknown as LineRow[]) {
    const header = headerMap.get(line.campaign_header_id);
    if (!header) continue;

    if (line.status && PNL_EXCLUDED_LINE_STATUSES.includes(line.status)) {
      continue;
    }

    const client = Array.isArray(header.client) ? header.client[0] : header.client;
    if (!client?.id) continue;

    const group = Array.isArray(client.group) ? client.group[0] : client.group;

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
      group_id: client.group_id ?? null,
      group_name: group?.name ?? null,
      period_month: resolvePeriodMonth(header),
      revenue: commercial.revenue,
      ur_rev: commercial.ur_rev,
      agency_fees: commercial.agency_fees,
      cost: vrAdjusted.cost,
      gp: vrAdjusted.gp,
      vr_refund: vrAdjusted.vr_refund,
      gp_after_vr: vrAdjusted.gp_after_vr,
      vr_rate_percent: vrRatePercent,
      currency_code: line.currency_code ?? "USD",
    });
  }

  return facts;
}

export type PnlReportQuery = {
  year?: number;
  compareYear?: number;
  period?: PnlPeriodScope;
  currency?: string;
  clientType?: ClientTypeFilter;
};

function buildPnlAvailableCurrencies(facts: PnlLineFact[]): string[] {
  const fromFacts = [
    ...new Set(
      facts
        .map((fact) => (fact.currency_code ?? "USD").trim().toUpperCase())
        .filter((code) => code.length === 3)
    ),
  ];
  return [
    ...new Set([...PNL_FALLBACK_DISPLAY_CURRENCIES, ...fromFacts]),
  ].sort();
}

export async function getPnLReport(query: PnlReportQuery = {}): Promise<PnlComparisonReportData> {
  const supabase = await createSupabaseServerClient();
  const currentYear = query.year ?? new Date().getFullYear();
  const priorYear = query.compareYear ?? currentYear - 1;
  const periodScope = query.period ?? "fy";
  const clientType = query.clientType ?? "all";
  const [rawFacts, agencyByClient] = await Promise.all([
    loadPnLLineFacts(supabase),
    loadClientAgencyOrDirectMap(supabase),
  ]);
  const filteredFacts = filterFactsByClientType(rawFacts, agencyByClient, clientType);
  const availableCurrencies = buildPnlAvailableCurrencies(filteredFacts);
  const displayCurrency = normalizePnlDisplayCurrency(query.currency, availableCurrencies);
  const lineFacts = await convertPnlFactsToDisplayCurrency(
    filteredFacts,
    displayCurrency,
    (fromCurrency, toCurrency) =>
      resolveEffectiveExchangeRate({ from_currency: fromCurrency, to_currency: toCurrency })
  );
  const report = buildPnLComparisonReport(
    lineFacts,
    currentYear,
    priorYear,
    periodScope,
    displayCurrency,
    availableCurrencies
  );
  return {
    ...report,
    client_type: clientType,
    client_type_label: clientTypeFilterLabel(clientType),
  };
}

export function parsePnLReportSearchParams(
  params: Record<string, string | string[] | undefined>
): PnlReportQuery {
  const read = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const currentYear = new Date().getFullYear();
  const year = parsePnlYear(read("year"), currentYear);
  const compareRaw = read("compare");
  const compareYear = compareRaw
    ? parsePnlYear(compareRaw, year - 1)
    : year - 1;

  const currencyRaw = read("currency");

  return {
    year,
    compareYear,
    period: parsePnlPeriodScope(read("period")),
    currency: currencyRaw?.trim().toUpperCase(),
    clientType: parseClientTypeFilter(read("clientType")),
  };
}
