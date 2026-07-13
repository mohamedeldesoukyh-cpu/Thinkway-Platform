import { notFound } from "next/navigation";
import Link from "next/link";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Button } from "@/components/ui/button";
import { DiscoverySubNav } from "@/features/discovery-import/components/discovery-sub-nav";
import { QUOTATIONS_LIST_PATH } from "@/features/quotations/constants";
import { QuotationWorkspace } from "@/features/quotations/components/quotation-workspace";
import {
  getPromoteWizardOptions,
  getQuotationDetail,
  getQuotationFormOptions,
} from "@/features/quotations/queries";
import { GenerateOutputsLauncher } from "@/features/campaign-outputs/components/generate-outputs-launcher";
import { seedFromQuotation } from "@/features/campaign-outputs/hydration/seed-adapters";
import { isUuid } from "@/lib/validation/uuid";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function QuotationDetailPage({ params }: PageProps) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [detail, formOptions, promoteOptions] = await Promise.all([
    getQuotationDetail(id),
    getQuotationFormOptions(),
    getPromoteWizardOptions(),
  ]);
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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DiscoverySubNav activeHref="/discovery/quotations" showDatabaseStats={false} />
          <div
            className="thinkway-campaign-workspace min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain bg-[var(--camp-surface)]"
            data-campaign-workspace-scroll
          >
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-4 py-2 md:px-6">
              <Button asChild variant="ghost" size="sm" className="-ml-2">
                <Link href={QUOTATIONS_LIST_PATH}>← Back to client quotations</Link>
              </Button>
              <GenerateOutputsLauncher
                seed={seedFromQuotation(detail)}
                tab="outputs"
                workspace={{ type: "quotation", id: detail.id }}
                className="w-full max-w-md sm:w-auto"
              />
            </div>
            <QuotationWorkspace
              detail={detail}
              formOptions={formOptions}
              promoteOptions={promoteOptions}
            />
          </div>
        </div>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
