import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { DiscoverySubNav } from "@/features/discovery-import/components/discovery-sub-nav";
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
          <DiscoverySubNav activeHref="/discovery/quotations" />
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 md:p-6">
            <section className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="font-heading text-2xl font-semibold tracking-tight">
                  Client Quotations
                </h2>
                <p className="text-sm text-muted-foreground">
                  Serial-numbered quotations (QT-YYYY-NNNN). Totals reported in EGP.
                </p>
              </div>
              <CreateQuotationDialog options={formOptions ?? { clients: [], brands: [], campaigns: [] }} />
            </section>

            {errorMessage ? (
              <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : quotations.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border px-6 py-16 text-center">
                <p className="text-sm font-medium">No quotations yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create one manually, from a shortlist, or from a Discovery selection.
                </p>
              </div>
            ) : (
              <QuotationsList quotations={quotations} />
            )}
          </div>
        </div>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
