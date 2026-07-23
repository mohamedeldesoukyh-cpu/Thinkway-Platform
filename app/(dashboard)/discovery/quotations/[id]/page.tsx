import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DiscoveryPageShell } from "@/features/discovery/components/discovery-page-shell";
import { QuotationWorkspace } from "@/features/quotations/components/quotation-workspace";
import { quotationDetailPath } from "@/features/quotations/constants";
import {
  getCachedPromoteWizardOptions,
  getCachedQuotationFormOptions,
  getQuotationDetail,
} from "@/features/quotations/queries";
import {
  metadataTitleForEntity,
  redirectToCanonicalEntityRoute,
} from "@/lib/routing/entity-page";
import {
  fetchQuotationRouteSummary,
  resolveQuotationIdByRouteKey,
} from "@/lib/routing/entity-route-queries";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id: routeKey } = await params;
  const quotationId = await resolveQuotationIdByRouteKey(routeKey);
  if (!quotationId) return { title: "Quotation" };

  const summary = await fetchQuotationRouteSummary(quotationId);
  if (!summary) return { title: "Quotation" };

  return {
    title: metadataTitleForEntity(summary, summary.serial_number),
  };
}

export default async function QuotationDetailPage({ params }: PageProps) {
  const { id: routeKey } = await params;

  const quotationId = await resolveQuotationIdByRouteKey(routeKey);
  if (!quotationId) notFound();

  const routeSummary = await fetchQuotationRouteSummary(quotationId);
  const canonicalPath = routeSummary
    ? quotationDetailPath({
        id: routeSummary.id,
        slug: routeSummary.slug,
        name: routeSummary.name,
        serial_number: routeSummary.serial_number,
      })
    : quotationDetailPath(quotationId);

  if (routeSummary) {
    redirectToCanonicalEntityRoute({
      routeKey,
      entity: {
        ...routeSummary,
        serial_number: routeSummary.serial_number ?? null,
      },
      canonicalPath,
    });
  }

  const [detail, formOptions, promoteOptions] = await Promise.all([
    getQuotationDetail(quotationId),
    getCachedQuotationFormOptions(),
    getCachedPromoteWizardOptions(),
  ]);

  if (!detail) notFound();

  return (
    <DiscoveryPageShell
      page="quotations"
      activeHref={canonicalPath}
      variant="flush"
      showHeader={false}
    >
      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-[var(--background)]">
        <QuotationWorkspace
          detail={detail}
          formOptions={formOptions}
          promoteOptions={promoteOptions}
        />
      </div>
    </DiscoveryPageShell>
  );
}
