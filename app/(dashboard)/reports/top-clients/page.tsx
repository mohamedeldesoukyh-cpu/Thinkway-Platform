import { FinanceSuiteShell } from "@/components/finance/suite/finance-suite-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { TopClientsView } from "@/features/reports/components/top-clients-view";
import {
  getTopClientsReport,
  parseTopClientsSearchParams,
} from "@/lib/analytics/queries/top-clients-report";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TopClientsReportPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = parseTopClientsSearchParams(params);
  const report = await getTopClientsReport(query);

  return (
    <FinanceSuiteShell
      title="Top clients"
      description="Rank legal entities by revenue or gross profit for a period."
      backFallbackHref="/reports"
      backLabel="Reports"
    >
      <PlatformErrorBoundary surface="analytics">
        <TopClientsView report={report} />
      </PlatformErrorBoundary>
    </FinanceSuiteShell>
  );
}
