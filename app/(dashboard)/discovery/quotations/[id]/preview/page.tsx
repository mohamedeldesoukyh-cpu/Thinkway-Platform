import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageBackButton } from "@/components/navigation/page-back-button";
import { DocumentPreviewClient } from "@/features/discovery/document-preview/document-preview-client";
import { QuotationPreviewDownloads } from "@/features/quotations/components/quotation-preview-downloads";
import { QuotationPreviewTemplateToggle } from "@/features/quotations/components/quotation-preview-template-toggle";
import {
  quotationDetailPath,
  quotationPreviewPath,
} from "@/features/quotations/constants";
import { resolveQuotationTemplate } from "@/features/quotations/export/quotation-template";
import { renderQuotationPreviewHtml } from "@/features/quotations/export/render-quotation-preview-html";
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
  searchParams: Promise<{ template?: string; items?: string }>;
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
    case "pitch":
      return "Pitch presentation";
    case "pitch-lump-sum":
      return "Pitch Lump Sum";
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
  const itemIds = query.items
    ? query.items.split(",").map((value) => value.trim()).filter(Boolean)
    : undefined;

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
  const previewParams = new URLSearchParams();
  if (template !== "detailed") previewParams.set("template", template);
  if (itemIds?.length) previewParams.set("items", itemIds.join(","));
  const previewQuery = previewParams.toString() || undefined;
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
      {
        ...(template !== "detailed" ? { template } : {}),
        ...(itemIds?.length ? { items: itemIds.join(",") } : {}),
      }
    );
  }

  const detail = await getQuotationDetail(quotationId);
  if (!detail) {
    notFound();
  }

  const templateLabel = quotationTemplateLabel(template);
  const serial = detail.serial_number ?? "QT-PENDING";

  let html = "";
  let creatorCount = 0;
  let errorMessage: string | null = null;
  try {
    const rendered = await renderQuotationPreviewHtml(supabase, detail.id, {
      template,
      itemIds,
    });
    html = rendered.html;
    creatorCount = rendered.creatorCount;
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to render quotation preview.";
  }

  return (
    <DashboardShell
      title="Quotation preview"
      description={`${serial} — ${templateLabel.toLowerCase()} client quotation`}
      hidePageHeader
    >
      {errorMessage ? (
        <div className="space-y-4">
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
          </div>
          <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        </div>
      ) : (
        <DocumentPreviewClient
          html={html}
          title={`${templateLabel} quotation ${serial}`}
          creatorCount={creatorCount}
          toolbarLeft={
            <>
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
            </>
          }
          toolbarRight={
            <QuotationPreviewDownloads
              quotationId={detail.id}
              template={template}
              itemIds={itemIds}
              exportRevision={detail.updated_at}
            />
          }
        />
      )}
    </DashboardShell>
  );
}
