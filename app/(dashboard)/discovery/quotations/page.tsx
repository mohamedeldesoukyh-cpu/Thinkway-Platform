import type { Metadata } from "next";
import { Suspense } from "react";

import { DiscoveryEmptyState } from "@/features/discovery/components/design-system";
import { DiscoveryPageShell } from "@/features/discovery/components/discovery-page-shell";
import { CreateQuotationDialog } from "@/features/quotations/components/create-quotation-dialog";
import { QuotationsList } from "@/features/quotations/components/quotations-list";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getCachedQuotationFormOptions,
  getQuotationsList,
} from "@/features/quotations/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Client Quotations",
};

async function QuotationsListSection() {
  let quotations: Awaited<ReturnType<typeof getQuotationsList>> = [];
  let formOptions: Awaited<ReturnType<typeof getCachedQuotationFormOptions>> = {
    clients: [],
    brands: [],
    campaigns: [],
  };
  let errorMessage: string | null = null;

  try {
    const [list, options] = await Promise.all([
      getQuotationsList(),
      getCachedQuotationFormOptions(),
    ]);
    quotations = list;
    formOptions = options;
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load quotations.";
  }

  if (errorMessage) {
    return (
      <div className="mx-8 mt-6 rounded-[var(--radius-lg)] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {errorMessage}
      </div>
    );
  }

  if (quotations.length === 0) {
    return (
      <div className="mx-8 mt-6 rounded-[var(--radius-lg)] border border-dashed border-border px-6 py-12">
        <DiscoveryEmptyState
          title="No quotations yet"
          description="Create one manually, from a shortlist, or from a Discovery selection."
        >
          <CreateQuotationDialog options={formOptions} />
        </DiscoveryEmptyState>
      </div>
    );
  }

  return (
    <QuotationsList
      quotations={quotations}
      brands={formOptions.brands}
      formOptions={formOptions}
    />
  );
}

function QuotationsListFallback() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden px-8 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>
      <div className="space-y-2 rounded-xl border border-border bg-card p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function DiscoveryQuotationsPage() {
  return (
    <DiscoveryPageShell page="quotations" variant="flush" showHeader={false}>
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
        <Suspense fallback={<QuotationsListFallback />}>
          <QuotationsListSection />
        </Suspense>
      </div>
    </DiscoveryPageShell>
  );
}
