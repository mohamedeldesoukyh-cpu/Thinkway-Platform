import {
  clientTypeFilterLabel,
  type ClientTypeFilter,
} from "@/lib/analytics/filters/client-type-filter";
import { buildDailyMonthTable } from "@/lib/analytics/daily/build-daily-month-table";
import {
  formatDailyMonthTitle,
  resolveDailyReportMonthKeys,
  resolveDailyReportPeriodLabel,
} from "@/lib/analytics/daily/daily-report-periods";
import type {
  DailyLineFact,
  DailyReportData,
  DailyReportQuery,
} from "@/lib/analytics/daily/daily-report-types";

export function buildDailyReport(
  facts: DailyLineFact[],
  query: DailyReportQuery,
  displayCurrency: string,
  availableCurrencies: string[],
  reference: Date = new Date(),
  clientType: ClientTypeFilter = "all"
): DailyReportData {
  const monthKeys = resolveDailyReportMonthKeys({
    year: query.year,
    viewMode: query.viewMode,
    month: query.month,
    period: query.period,
  });

  const yearPrefix = `${query.year}-`;
  const scopedFacts = facts.filter((fact) => fact.period_date.startsWith(yearPrefix));

  const tables = monthKeys.map((monthKey) =>
    buildDailyMonthTable(
      monthKey,
      formatDailyMonthTitle(monthKey),
      scopedFacts,
      reference
    )
  );

  return {
    year: query.year,
    view_mode: query.viewMode,
    layout: query.layout,
    month: query.viewMode === "month" ? query.month : null,
    period_scope: query.viewMode === "period" ? query.period : null,
    period_label: resolveDailyReportPeriodLabel({
      viewMode: query.viewMode,
      year: query.year,
      month: query.month,
      period: query.period,
    }),
    display_currency: displayCurrency,
    available_currencies: availableCurrencies,
    client_type: clientType,
    client_type_label: clientTypeFilterLabel(clientType),
    tables,
    data_scope_note:
      "Daily revenue and GP from campaign lines by campaign start date. Cancelled lines excluded. VR applied in summary rows.",
  };
}
