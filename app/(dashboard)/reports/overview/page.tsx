import { getBuiltinReportPresentation } from "@/lib/reports/builtin-report-presentation";
import { FinanceSuiteShell } from "@/components/finance/suite/finance-suite-shell";
import { OverviewReportView } from "@/features/reports/components/overview-report-view";
import { getOverviewReport } from "@/lib/reports/queries/get-overview-report";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeOverviewColumnPreferences, OVERVIEW_PREFERENCE_KEY } from "@/lib/reports/overview/overview-column-preferences";

export default async function OverviewReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const preferences = normalizeOverviewColumnPreferences(user?.user_metadata?.[OVERVIEW_PREFERENCE_KEY]);
  const selectedColumns = preferences.order.filter(key => preferences.columns.includes(key));
  const report = await getOverviewReport({ ...params, columns: params.columns ?? selectedColumns.join(",") }, supabase);
  const presentation = await getBuiltinReportPresentation("overview");
  return <FinanceSuiteShell title={presentation?.name ?? "Overview Report"} description={presentation?.description ?? "Campaign revenue, cost and gross profit — actual and accrued."} backFallbackHref="/reports" backLabel="Reports" hideDefaultActions>
    <OverviewReportView report={report} savedPreferences={preferences} />
  </FinanceSuiteShell>;
}
