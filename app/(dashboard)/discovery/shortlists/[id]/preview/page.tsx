import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageBackButton } from "@/components/navigation/page-back-button";
import { ShortlistPreviewDownloads } from "@/features/discovery/shortlists/components/shortlist-preview-downloads";
import { ShortlistPreviewTemplateToggle } from "@/features/discovery/shortlists/components/shortlist-preview-template-toggle";
import {
  shortlistDetailPath,
  shortlistPreviewPath,
} from "@/features/discovery/shortlists/constants";
import {
  appendShortlistExportRevision,
  appendShortlistTemplateParam,
  resolveShortlistTemplate,
} from "@/features/discovery/shortlists/export/shortlist-template";
import { getShortlistDetail } from "@/features/discovery/shortlists/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { metadataTitleForEntity, redirectToCanonicalEntityRoute } from "@/lib/routing/entity-page";
import {
  fetchShortlistRouteSummary,
  resolveShortlistIdByRouteKey,
} from "@/lib/routing/entity-route-queries";

export const dynamic = "force-dynamic";

type ShortlistPreviewPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ template?: string; items?: string }>;
};

export async function generateMetadata({
  params,
}: Pick<ShortlistPreviewPageProps, "params">): Promise<Metadata> {
  const { id: routeKey } = await params;
  const shortlistId = await resolveShortlistIdByRouteKey(routeKey);
  if (!shortlistId) return { title: "Shortlist preview" };

  const summary = await fetchShortlistRouteSummary(shortlistId);
  if (!summary) return { title: "Shortlist preview" };

  return {
    title: `${metadataTitleForEntity(summary, summary.serial_number)} preview`,
  };
}

function shortlistTemplateLabel(
  template: ReturnType<typeof resolveShortlistTemplate>
): string {
  switch (template) {
    case "showcase":
      return "Showcase";
    case "detailed":
      return "Detailed";
    default:
      return "Summary";
  }
}

export default async function ShortlistPreviewPage({
  params,
  searchParams,
}: ShortlistPreviewPageProps) {
  const { id: routeKey } = await params;
  const query = await searchParams;
  const template = resolveShortlistTemplate(query.template);
  const itemIds = query.items
    ? query.items.split(",").map((value) => value.trim()).filter(Boolean)
    : undefined;

  const shortlistId = await resolveShortlistIdByRouteKey(routeKey);
  if (!shortlistId) notFound();

  const routeSummary = await fetchShortlistRouteSummary(shortlistId);
  const canonicalPath = routeSummary
    ? shortlistPreviewPath(
        {
          id: routeSummary.id,
          slug: routeSummary.slug,
          name: routeSummary.name,
          serial_number: routeSummary.serial_number ?? null,
        },
        { template, itemIds }
      )
    : shortlistPreviewPath(shortlistId, { template, itemIds });

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
        ...(template !== "summary" ? { template } : {}),
        ...(itemIds?.length ? { items: itemIds.join(",") } : {}),
      }
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const detail = await getShortlistDetail(shortlistId);
  if (!detail) {
    notFound();
  }

  const templateLabel = shortlistTemplateLabel(template);
  const serial = detail.serial_number ?? "SL-PENDING";
  const previewParams = new URLSearchParams({ format: "preview" });
  appendShortlistTemplateParam(previewParams, template);
  appendShortlistExportRevision(previewParams, detail.updated_at);
  if (itemIds?.length) {
    previewParams.set("items", itemIds.join(","));
  }
  const previewSrc = `/api/shortlists/${shortlistId}/export?${previewParams.toString()}`;

  return (
    <DashboardShell
      title="Shortlist preview"
      description={`${serial} — ${templateLabel.toLowerCase()} creator roster`}
      hidePageHeader
    >
      <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:-mx-8 md:px-8 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <PageBackButton
              fallbackHref={shortlistDetailPath({
                id: detail.id,
                slug: detail.slug ?? null,
                name: detail.name,
                serial_number: detail.serial_number,
              })}
              label="Back to shortlist"
              variant="text"
            />
            <Suspense fallback={null}>
              <ShortlistPreviewTemplateToggle
                shortlistId={shortlistId}
                activeTemplate={template}
                itemIds={itemIds}
              />
            </Suspense>
          </div>
          <ShortlistPreviewDownloads
            shortlistId={shortlistId}
            template={template}
            itemIds={itemIds}
            exportRevision={detail.updated_at}
          />
        </div>
      </div>

      <iframe
        title={`${templateLabel} shortlist ${serial}`}
        src={previewSrc}
        className="min-h-[1200px] w-full rounded-xl border border-border bg-card"
      />
    </DashboardShell>
  );
}
