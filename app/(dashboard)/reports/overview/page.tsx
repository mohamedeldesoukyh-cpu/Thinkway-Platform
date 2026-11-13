import { FinanceSuiteShell } from "@/components/finance/suite/finance-suite-shell";
import { OverviewReportView } from "@/features/reports/components/overview-report-view";
import { getOverviewReport } from "@/lib/reports/queries/get-overview-report";

export default async function OverviewReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const report = await getOverviewReport(await searchParams);
  return <FinanceSuiteShell title="Overview Report" description="Campaign revenue, cost and gross profit — actual and accrued." backFallbackHref="/reports" backLabel="Reports">
    <OverviewReportView report={report} />
  </FinanceSuiteShell>;
}
