import { FinanceSuiteShell } from "@/components/finance/suite";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { PnlReportView } from "@/features/reports/components/pnl-report-view";
import {
  getPnLReport,
  parsePnLReportSearchParams,
} from "@/lib/analytics/queries/pnl-report";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PnlReportPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = parsePnLReportSearchParams(params);
  const report = await getPnLReport(query);

  return (
    <FinanceSuiteShell
      title="P&L report"
      description="Year-over-year revenue, COGS, and gross profit with client drill-down."
      backFallbackHref="/reports"
      backLabel="Reports"
    >
      <PlatformErrorBoundary surface="analytics">
        <PnlReportView report={report} />
      </PlatformErrorBoundary>
    </FinanceSuiteShell>
  );
}
