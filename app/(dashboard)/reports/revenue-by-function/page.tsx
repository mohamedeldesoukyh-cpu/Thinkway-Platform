import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { RevenueByFunctionView } from "@/features/reports/components/revenue-by-function-view";
import {
  getRevenueByFunctionReport,
  parseRevenueByFunctionSearchParams,
} from "@/lib/analytics/queries/revenue-by-function-report";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RevenueByFunctionReportPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = parseRevenueByFunctionSearchParams(params);
  const report = await getRevenueByFunctionReport(query);

  return (
    <DashboardShell
      title="Revenue by function"
      description="Revenue and GP attributed to OPS and Sales teams by account manager."
      backFallbackHref="/reports"
      backLabel="Reports"
    >
      <PlatformErrorBoundary surface="analytics">
        <RevenueByFunctionView report={report} />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
