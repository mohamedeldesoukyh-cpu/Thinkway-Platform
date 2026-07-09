import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { DiscoverySubNav } from "@/features/discovery-import/components/discovery-sub-nav";
import {
  DISCOVERY_PAGE_IDENTITY,
  DiscoveryPageHeader,
} from "@/features/discovery/components/discovery-page-identity";
import { CreateQuotationDialog } from "@/features/quotations/components/create-quotation-dialog";
import { QuotationsList } from "@/features/quotations/components/quotations-list";
import { getQuotationFormOptions, getQuotationsList } from "@/features/quotations/queries";
import type { QuotationListRow } from "@/features/quotations/types";

export const dynamic = "force-dynamic";

export default async function DiscoveryQuotationsPage() {
  let quotations: QuotationListRow[] = [];
  let formOptions: Awaited<ReturnType<typeof getQuotationFormOptions>> | null = null;
  let errorMessage: string | null = null;

  try {
    const [list, options] = await Promise.all([
      getQuotationsList(),
      getQuotationFormOptions(),
    ]);
    quotations = list;
    formOptions = options;
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load quotations.";
  }

  return (
    <DashboardShell
      title="Client Quotations"
      description="Build, price, and export client quotations with EGP reporting."
      hidePageHeader
      containedMain
      mainClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
    >
      <PlatformErrorBoundary surface="generic">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <DiscoverySubNav activeHref="/discovery/quotations" showDatabaseStats={false} />
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 md:p-4">
            <DiscoveryPageHeader
              identity={DISCOVERY_PAGE_IDENTITY.quotations}
              actions={
                <CreateQuotationDialog
                  options={formOptions ?? { clients: [], brands: [], campaigns: [] }}
                />
              }
            />

            {errorMessage ? (
              <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : quotations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-4 py-12 text-center">
                <p className="text-sm font-medium">No quotations yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create one manually, from a shortlist, or from a Discovery selection.
                </p>
              </div>
            ) : (
              <QuotationsList
                quotations={quotations}
                brands={formOptions?.brands ?? []}
              />
            )}
          </div>
        </div>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
