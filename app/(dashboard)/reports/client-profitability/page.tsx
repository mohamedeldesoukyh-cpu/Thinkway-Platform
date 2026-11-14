import { getBuiltinReportPresentation } from "@/lib/reports/builtin-report-presentation";
import { FinanceSuiteShell } from "@/components/finance/suite/finance-suite-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { ClientProfitabilityView } from "@/features/reports/components/client-profitability-view";
import {
  getClientProfitabilityReport,
  parseClientProfitabilitySearchParams,
} from "@/lib/analytics/queries/client-profitability-report";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClientProfitabilityReportPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = parseClientProfitabilitySearchParams(params);
  const report = await getClientProfitabilityReport(query);

  const presentation = await getBuiltinReportPresentation("client-profitability");
  return (
    <FinanceSuiteShell
      title={presentation?.name ?? "Profitability by client"}
      description={presentation?.description ?? "Gross profit and margin by legal entity. Compare up to three clients."}
      backFallbackHref="/reports"
      backLabel="Reports"
    >
      <PlatformErrorBoundary surface="analytics">
        <ClientProfitabilityView report={report} />
      </PlatformErrorBoundary>
    </FinanceSuiteShell>
  );
}
