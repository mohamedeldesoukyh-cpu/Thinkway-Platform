import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageBackButton } from "@/components/navigation/page-back-button";
import { DocumentPreviewClient } from "@/features/discovery/document-preview/document-preview-client";
import { ShortlistPreviewDownloads } from "@/features/discovery/shortlists/components/shortlist-preview-downloads";
import { ShortlistPreviewTemplateToggle } from "@/features/discovery/shortlists/components/shortlist-preview-template-toggle";
import {
  shortlistDetailPath,
  shortlistPreviewPath,
} from "@/features/discovery/shortlists/constants";
import { resolveShortlistTemplate } from "@/features/discovery/shortlists/export/shortlist-template";
import { renderShortlistPreviewHtml } from "@/features/discovery/shortlists/export/render-shortlist-preview-html";
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
    case "pitch":
      return "Pitch presentation";
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

  let html = "";
  let creatorCount = 0;
  let errorMessage: string | null = null;
  try {
    const rendered = await renderShortlistPreviewHtml(supabase, shortlistId, {
      template,
      itemIds,
    });
    html = rendered.html;
    creatorCount = rendered.creatorCount;
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to render shortlist preview.";
  }

  return (
    <DashboardShell
      title="Shortlist preview"
      description={`${serial} — ${templateLabel.toLowerCase()} creator roster`}
      hidePageHeader
    >
      {errorMessage ? (
        <div className="space-y-4">
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
          </div>
          <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        </div>
      ) : (
        <DocumentPreviewClient
          html={html}
          title={`${templateLabel} shortlist ${serial}`}
          creatorCount={creatorCount}
          toolbarLeft={
            <>
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
            </>
          }
          toolbarRight={
            <ShortlistPreviewDownloads
              shortlistId={shortlistId}
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
