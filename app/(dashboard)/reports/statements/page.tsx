import { getBuiltinReportPresentation } from "@/lib/reports/builtin-report-presentation";
import { FinanceSuiteShell } from "@/components/finance/suite/finance-suite-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { StatementsIndexView } from "@/features/reports/components/statements-index-view";
import { getStatementsIndex } from "@/lib/reports/queries/get-statements-index";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StatementsReportPage({ searchParams }: Props) {
  const params = await searchParams;
  const data = await getStatementsIndex(params);

  const presentation = await getBuiltinReportPresentation("statements");
  return (
    <FinanceSuiteShell
      title={presentation?.name ?? "Statements"}
      description={presentation?.description ?? "Browse client and vendor statement ledgers, or search to filter the list."}
      backFallbackHref="/reports"
      backLabel="Reports"
    >
      <PlatformErrorBoundary surface="analytics">
        <StatementsIndexView data={data} />
      </PlatformErrorBoundary>
    </FinanceSuiteShell>
  );
}
