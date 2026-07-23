import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageBackButton } from "@/components/navigation/page-back-button";
import { QuotationPreviewDownloads } from "@/features/quotations/components/quotation-preview-downloads";
import { QuotationPreviewTemplateToggle } from "@/features/quotations/components/quotation-preview-template-toggle";
import {
  quotationDetailPath,
  quotationPreviewPath,
} from "@/features/quotations/constants";
import {
  appendQuotationExportRevision,
  resolveQuotationTemplate,
} from "@/features/quotations/export/quotation-template";
import { getQuotationDetail } from "@/features/quotations/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { metadataTitleForEntity, redirectToCanonicalEntityRoute } from "@/lib/routing/entity-page";
import {
  fetchQuotationRouteSummary,
  resolveQuotationIdByRouteKey,
} from "@/lib/routing/entity-route-queries";

export const dynamic = "force-dynamic";

type QuotationPreviewPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ template?: string }>;
};

export async function generateMetadata({
  params,
}: Pick<QuotationPreviewPageProps, "params">): Promise<Metadata> {
  const { id: routeKey } = await params;
  const quotationId = await resolveQuotationIdByRouteKey(routeKey);
  if (!quotationId) return { title: "Quotation preview" };

  const summary = await fetchQuotationRouteSummary(quotationId);
  if (!summary) return { title: "Quotation preview" };

  return {
    title: `${metadataTitleForEntity(summary, summary.serial_number)} preview`,
  };
}

function quotationTemplateLabel(
  template: ReturnType<typeof resolveQuotationTemplate>
): string {
  switch (template) {
    case "lump-sum":
      return "Lump sum";
    case "showcase":
      return "Showcase";
    case "showcase-lump-sum":
      return "Showcase Lump Sum";
    default:
      return "Detailed";
  }
}

export default async function QuotationPreviewPage({
  params,
  searchParams,
}: QuotationPreviewPageProps) {
  const { id: routeKey } = await params;
  const query = await searchParams;
  const template = resolveQuotationTemplate(query.template);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const quotationId = await resolveQuotationIdByRouteKey(routeKey);
  if (!quotationId) notFound();

  const routeSummary = await fetchQuotationRouteSummary(quotationId);
  const previewQuery =
    template !== "detailed" ? `template=${encodeURIComponent(template)}` : undefined;
  const canonicalPath = routeSummary
    ? quotationPreviewPath(
        {
          id: routeSummary.id,
          slug: routeSummary.slug,
          name: routeSummary.name,
          serial_number: routeSummary.serial_number,
        },
        undefined,
        previewQuery
      )
    : quotationPreviewPath(quotationId, undefined, previewQuery);

  if (routeSummary) {
    redirectToCanonicalEntityRoute(
      {
        routeKey,
        entity: {
          ...routeSummary,
          serial_number: routeSummary.serial_number ?? null,
        },
        canonicalPath,
      },
      undefined,
      previewQuery ? { template } : undefined
    );
  }

  const detail = await getQuotationDetail(quotationId);
  if (!detail) {
    notFound();
  }

  const templateLabel = quotationTemplateLabel(template);
  const serial = detail.serial_number ?? "QT-PENDING";
  const previewParams = new URLSearchParams({ format: "preview" });
  if (template !== "detailed") {
    previewParams.set("template", template);
  }
  appendQuotationExportRevision(previewParams, detail.updated_at);
  const previewSrc = `/api/quotations/${detail.id}/export?${previewParams.toString()}`;

  return (
    <DashboardShell
      title="Quotation preview"
      description={`${serial} — ${templateLabel.toLowerCase()} client quotation`}
      hidePageHeader
    >
      <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:-mx-8 md:px-8 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <PageBackButton
              fallbackHref={quotationDetailPath({
                id: detail.id,
                name: detail.name,
                serial_number: detail.serial_number,
              })}
              label="Back to quotation"
              variant="text"
            />
            <Suspense fallback={null}>
              <QuotationPreviewTemplateToggle
                quotationId={detail.id}
                serialNumber={detail.serial_number}
                activeTemplate={template}
              />
            </Suspense>
          </div>
          <QuotationPreviewDownloads
            quotationId={detail.id}
            template={template}
            exportRevision={detail.updated_at}
          />
        </div>
      </div>

      <iframe
        title={`${templateLabel} quotation ${serial}`}
        src={previewSrc}
        className="min-h-[1200px] w-full rounded-xl border border-border bg-card"
      />
    </DashboardShell>
  );
}
