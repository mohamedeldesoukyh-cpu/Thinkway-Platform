import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { SpendingByCategoryView } from "@/features/reports/components/spending-by-category-view";
import {
  getSpendingByCategoryReport,
  parseSpendingByCategorySearchParams,
} from "@/lib/analytics/queries/spending-by-category-report";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SpendingByCategoryReportPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = parseSpendingByCategorySearchParams(params);
  const report = await getSpendingByCategoryReport(query);

  return (
    <DashboardShell
      title="Spending by category"
      description="Client intelligence spending rolled up by category with full drill-down."
      backFallbackHref="/reports"
      backLabel="Reports"
    >
      <PlatformErrorBoundary surface="analytics">
        <SpendingByCategoryView report={report} />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
