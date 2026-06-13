import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { DailyReportView } from "@/features/reports/components/daily-report-view";
import {
  getDailyReport,
  parseDailyReportSearchParams,
} from "@/lib/analytics/queries/daily-report";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DailyReportPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = parseDailyReportSearchParams(params);
  const report = await getDailyReport(query);

  return (
    <DashboardShell
      title="Daily report"
      description="Day-by-day revenue and gross profit with monthly summaries."
      backFallbackHref="/reports"
      backLabel="Reports"
    >
      <PlatformErrorBoundary surface="analytics">
        <DailyReportView report={report} />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
