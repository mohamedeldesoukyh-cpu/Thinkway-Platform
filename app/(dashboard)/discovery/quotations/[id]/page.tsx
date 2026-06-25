import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { QuotationWorkspace } from "@/features/quotations/components/quotation-workspace";
import { getQuotationDetail } from "@/features/quotations/queries";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function QuotationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const detail = await getQuotationDetail(id);
  if (!detail) notFound();

  return (
    <DashboardShell
      title={detail.name}
      description={detail.serial_number ?? "Client quotation"}
      hidePageHeader
      containedMain
      mainClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
    >
      <PlatformErrorBoundary surface="generic">
        <QuotationWorkspace detail={detail} />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
