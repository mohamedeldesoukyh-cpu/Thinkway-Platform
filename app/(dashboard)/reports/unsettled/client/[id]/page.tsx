import { notFound } from "next/navigation";

import { FinanceSuiteShell } from "@/components/finance/suite/finance-suite-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { UnsettledDetailView } from "@/features/reports/components/unsettled-detail-view";
import {
  getUnsettledReport,
  parseUnsettledReportSearchParams,
} from "@/lib/reports/queries/get-unsettled-report";
import { formatGroupClientLabel } from "@/lib/reports/statements/entity-label";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClientUnsettledPage({ params, searchParams }: Props) {
  const { id } = await params;
  const queryParams = await searchParams;
  const query = parseUnsettledReportSearchParams({
    ...queryParams,
    entityId: id,
  });
  const report = await getUnsettledReport(query);

  if (!report.entity_name) {
    notFound();
  }

  const entityLabel =
    formatGroupClientLabel(report.group_name, report.entity_name) ?? report.entity_name;

  return (
    <FinanceSuiteShell
      title="Statement of unsettled"
      description={`Open AR invoices for ${entityLabel}.`}
      backFallbackHref="/reports/unsettled"
      backLabel="Statement of Unsettled"
    >
      <PlatformErrorBoundary surface="analytics">
        <UnsettledDetailView report={report} />
      </PlatformErrorBoundary>
    </FinanceSuiteShell>
  );
}
