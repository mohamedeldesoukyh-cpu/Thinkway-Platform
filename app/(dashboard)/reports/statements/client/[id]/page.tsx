import { notFound } from "next/navigation";

import { FinanceSuiteShell } from "@/components/finance/suite/finance-suite-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { StatementsDetailView } from "@/features/reports/components/statements-detail-view";
import {
  getStatementsReport,
  parseStatementsReportSearchParams,
} from "@/lib/reports/queries/get-statements-report";
import { formatGroupClientLabel } from "@/lib/reports/statements/entity-label";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClientStatementPage({ params, searchParams }: Props) {
  const { id } = await params;
  const queryParams = await searchParams;
  const query = parseStatementsReportSearchParams({
    ...queryParams,
    type: "client",
    entityId: id,
  });
  const report = await getStatementsReport(query);

  if (!report.entity_name) {
    notFound();
  }

  const entityLabel =
    formatGroupClientLabel(report.group_name, report.entity_name) ?? report.entity_name;

  return (
    <FinanceSuiteShell
      title="Client statement"
      description={`AR ledger for ${entityLabel}.`}
      backFallbackHref="/reports/statements"
      backLabel="Statements"
    >
      <PlatformErrorBoundary surface="analytics">
        <StatementsDetailView report={report} />
      </PlatformErrorBoundary>
    </FinanceSuiteShell>
  );
}
