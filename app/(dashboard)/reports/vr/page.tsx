import { FinanceSuiteShell } from "@/components/finance/suite";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { VrReportView } from "@/features/reports/components/vr-report-view";
import {
  getVrReport,
  parseVrReportSearchParams,
} from "@/lib/analytics/queries/vr-report";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function VrReportPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = parseVrReportSearchParams(params);
  const report = await getVrReport(query);

  return (
    <FinanceSuiteShell
      title="VR report"
      description="Vendor rebate amounts by legal entity with monthly breakdown."
      backFallbackHref="/reports"
      backLabel="Reports"
    >
      <PlatformErrorBoundary surface="analytics">
        <VrReportView report={report} />
      </PlatformErrorBoundary>
    </FinanceSuiteShell>
  );
}
