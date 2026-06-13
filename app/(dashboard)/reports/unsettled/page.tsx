import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { UnsettledIndexView } from "@/features/reports/components/unsettled-index-view";
import { getUnsettledIndex } from "@/lib/reports/queries/get-unsettled-report";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UnsettledReportPage({ searchParams }: Props) {
  const params = await searchParams;
  const data = await getUnsettledIndex(params);

  return (
    <DashboardShell
      title="Statement of Unsettled"
      description="Browse legal entities with open AR invoices, or search to filter the list."
      backFallbackHref="/reports"
      backLabel="Reports"
    >
      <PlatformErrorBoundary surface="analytics">
        <UnsettledIndexView data={data} />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
