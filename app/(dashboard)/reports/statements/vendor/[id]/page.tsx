import { notFound } from "next/navigation";

import { FinanceSuiteShell } from "@/components/finance/suite";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { StatementsDetailView } from "@/features/reports/components/statements-detail-view";
import {
  getStatementsReport,
  parseStatementsReportSearchParams,
} from "@/lib/reports/queries/get-statements-report";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function VendorStatementPage({ params, searchParams }: Props) {
  const { id } = await params;
  const queryParams = await searchParams;
  const query = parseStatementsReportSearchParams({
    ...queryParams,
    type: "vendor",
    entityId: id,
  });
  const report = await getStatementsReport(query);

  if (!report.entity_name) {
    notFound();
  }

  return (
    <FinanceSuiteShell
      title="Vendor statement"
      description={`AP ledger for ${report.entity_name}.`}
      backFallbackHref="/reports/statements?type=vendor"
      backLabel="Statements"
    >
      <PlatformErrorBoundary surface="analytics">
        <StatementsDetailView report={report} />
      </PlatformErrorBoundary>
    </FinanceSuiteShell>
  );
}
