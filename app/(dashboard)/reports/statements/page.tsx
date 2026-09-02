import { FinanceSuiteShell } from "@/components/finance/suite";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { StatementsIndexView } from "@/features/reports/components/statements-index-view";
import { getStatementsIndex } from "@/lib/reports/queries/get-statements-index";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StatementsReportPage({ searchParams }: Props) {
  const params = await searchParams;
  const data = await getStatementsIndex(params);

  return (
    <FinanceSuiteShell
      title="Statements"
      description="Browse client and vendor statement ledgers, or search to filter the list."
      backFallbackHref="/reports"
      backLabel="Reports"
    >
      <PlatformErrorBoundary surface="analytics">
        <StatementsIndexView data={data} />
      </PlatformErrorBoundary>
    </FinanceSuiteShell>
  );
}
