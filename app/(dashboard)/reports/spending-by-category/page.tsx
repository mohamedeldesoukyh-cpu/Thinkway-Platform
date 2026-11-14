import { getBuiltinReportPresentation } from "@/lib/reports/builtin-report-presentation";
import { FinanceSuiteShell } from "@/components/finance/suite/finance-suite-shell";
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

  const presentation = await getBuiltinReportPresentation("spending-by-category");
  return (
    <FinanceSuiteShell
      title={presentation?.name ?? "Spending by category"}
      description={presentation?.description ?? "Client intelligence spending rolled up by category with full drill-down."}
      backFallbackHref="/reports"
      backLabel="Reports"
    >
      <PlatformErrorBoundary surface="analytics">
        <SpendingByCategoryView report={report} />
      </PlatformErrorBoundary>
    </FinanceSuiteShell>
  );
}
