import { roundMoney } from "@/lib/analytics/aggregations/round";
import {
  clientTypeFilterLabel,
  matchesClientType,
  type ClientTypeFilter,
} from "@/lib/analytics/filters/client-type-filter";
import { computeMarginPercent } from "@/lib/analytics/metrics/financial";
import {
  monthsForScope,
  periodScopeLabel,
  type PnlPeriodScope,
} from "@/lib/analytics/pnl/pnl-periods";
import type {
  RevenueByFunctionFilter,
  RevenueByFunctionLineFact,
  RevenueByFunctionReportData,
  RevenueByFunctionRow,
  RevenueByFunctionUserOption,
} from "@/lib/analytics/revenue-by-function/revenue-by-function-types";
import type { AgencyOrDirect, BusinessFunction } from "@/types/database";

function functionFilterLabel(filter: RevenueByFunctionFilter): string {
  if (filter === "ops") return "OPS";
  if (filter === "sales") return "Sales";
  return "All functions";
}

function functionRowLabel(value: BusinessFunction | null): string {
  if (value === "ops") return "OPS";
  if (value === "sales") return "Sales";
  return "Unset";
}

function matchesFunctionFilter(
  value: BusinessFunction | null,
  filter: RevenueByFunctionFilter
): boolean {
  if (filter === "all") return true;
  return value === filter;
}

function aggregateByUser(
  facts: RevenueByFunctionLineFact[],
  scopeMonths: string[],
  agencyByClient: Map<string, AgencyOrDirect | null>,
  clientType: ClientTypeFilter
): Map<
  string,
  {
    user_id: string | null;
    user_name: string;
    business_function: BusinessFunction | null;
    revenue: number;
    gp: number;
  }
> {
  const byUser = new Map<
    string,
    {
      user_id: string | null;
      user_name: string;
      business_function: BusinessFunction | null;
      revenue: number;
      gp: number;
    }
  >();

  for (const fact of facts) {
    if (!fact.period_month || !scopeMonths.includes(fact.period_month)) continue;
    if (!matchesClientType(agencyByClient.get(fact.client_id) ?? null, clientType)) {
      continue;
    }

    const key = fact.account_manager_id ?? "__unassigned__";
    const billableRevenue = roundMoney(fact.revenue + fact.ur_rev + fact.agency_fees);
    const gpAfterVr = roundMoney(fact.gp_after_vr);

    const bucket =
      byUser.get(key) ??
      {
        user_id: fact.account_manager_id,
        user_name: fact.account_manager_name ?? "Unassigned",
        business_function: fact.business_function,
        revenue: 0,
        gp: 0,
      };

    bucket.revenue = roundMoney(bucket.revenue + billableRevenue);
    bucket.gp = roundMoney(bucket.gp + gpAfterVr);
    byUser.set(key, bucket);
  }

  return byUser;
}

function buildSummaryRows(
  rows: RevenueByFunctionRow[],
  functionFilter: RevenueByFunctionFilter
): RevenueByFunctionRow[] {
  const summaries: RevenueByFunctionRow[] = [];

  const sumFor = (fn: BusinessFunction) => {
    const matching = rows.filter((row) => row.business_function === fn);
    const revenue = roundMoney(matching.reduce((sum, row) => sum + row.revenue, 0));
    const gp = roundMoney(matching.reduce((sum, row) => sum + row.gp, 0));
    return {
      user_id: null,
      user_name: `${functionRowLabel(fn)} total`,
      business_function: fn,
      business_function_label: functionRowLabel(fn),
      revenue,
      gp,
      gp_percent: computeMarginPercent(revenue, gp),
      is_summary: true,
    } satisfies RevenueByFunctionRow;
  };

  if (functionFilter === "all" || functionFilter === "ops") {
    summaries.push(sumFor("ops"));
  }
  if (functionFilter === "all" || functionFilter === "sales") {
    summaries.push(sumFor("sales"));
  }

  return summaries;
}

export function buildRevenueByFunctionReport(
  lineFacts: RevenueByFunctionLineFact[],
  agencyByClient: Map<string, AgencyOrDirect | null>,
  userOptions: RevenueByFunctionUserOption[],
  year: number,
  periodScope: PnlPeriodScope,
  displayCurrency: string,
  availableCurrencies: string[],
  functionFilter: RevenueByFunctionFilter,
  userFilter: string,
  clientType: ClientTypeFilter
): RevenueByFunctionReportData {
  const scopeMonths = monthsForScope(year, periodScope);
  const yearFacts = lineFacts.filter((fact) => fact.period_month?.startsWith(String(year)));
  const aggregated = aggregateByUser(yearFacts, scopeMonths, agencyByClient, clientType);

  let rows: RevenueByFunctionRow[] = [...aggregated.values()]
    .filter((row) => row.revenue !== 0 || row.gp !== 0)
    .map((row) => ({
      user_id: row.user_id,
      user_name: row.user_name,
      business_function: row.business_function,
      business_function_label: functionRowLabel(row.business_function),
      revenue: row.revenue,
      gp: row.gp,
      gp_percent: computeMarginPercent(row.revenue, row.gp),
    }))
    .filter((row) => matchesFunctionFilter(row.business_function, functionFilter));

  if (userFilter && userFilter !== "all") {
    rows = rows.filter((row) => row.user_id === userFilter);
  }

  rows.sort((a, b) => {
    const byRevenue = b.revenue - a.revenue;
    if (byRevenue !== 0) return byRevenue;
    return a.user_name.localeCompare(b.user_name);
  });

  const filteredUserOptions = userOptions.filter((user) =>
    matchesFunctionFilter(user.business_function, functionFilter)
  );

  const selectedUser = userOptions.find((user) => user.id === userFilter);

  return {
    year,
    period_scope: periodScope,
    period_label: periodScopeLabel(periodScope),
    display_currency: displayCurrency,
    available_currencies: availableCurrencies,
    function_filter: functionFilter,
    function_filter_label: functionFilterLabel(functionFilter),
    user_filter: userFilter,
    user_filter_label:
      userFilter === "all"
        ? "All users"
        : selectedUser?.name ?? "Selected user",
    client_type: clientType,
    client_type_label: clientTypeFilterLabel(clientType),
    rows,
    summary_rows: buildSummaryRows(rows, functionFilter),
    user_options: filteredUserOptions,
    period_note: `All amounts shown in ${displayCurrency} using effective exchange rates. GP is after VR refund; GP % is GP divided by billable revenue.`,
    data_scope_note:
      "Revenue is attributed to the campaign account manager on each campaign header. Includes active, paused, and completed campaigns only. Cancelled campaigns and lines are excluded. Billable revenue includes deliverable revenue, UR, and agency fees.",
  };
}
