import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageBackButton } from "@/components/navigation/page-back-button";
import { PerformanceReportPreviewDownloads } from "@/features/campaigns/components/performance/performance-report-preview-downloads";
import { PerformanceReportPreviewVariantToggle } from "@/features/campaigns/components/performance/performance-report-preview-variant-toggle";
import {
  loadPerformanceReportDocumentData,
  renderPerformanceReportHtml,
  type PerformanceReportVariant,
} from "@/lib/performance/report";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/uuid";

type CampaignPerformancePreviewPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ variant?: string; publicationIds?: string }>;
};

function resolveVariant(raw: string | undefined): PerformanceReportVariant {
  return raw === "influencers" ? "influencers" : "combined";
}

function parsePublicationIds(raw: string | undefined): string[] | undefined {
  if (!raw?.trim()) return undefined;
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => isUuid(id));
  return ids.length > 0 ? ids : undefined;
}

export default async function CampaignPerformancePreviewPage({
  params,
  searchParams,
}: CampaignPerformancePreviewPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const variant = resolveVariant(query.variant);
  const publicationIds = parsePublicationIds(query.publicationIds);

  if (!isUuid(id)) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: campaign } = await supabase
    .from("campaign_headers")
    .select("id, document_number, name")
    .eq("id", id)
    .maybeSingle();

  if (!campaign) {
    notFound();
  }

  const typed = campaign as {
    id: string;
    document_number: string | null;
    name: string;
  };

  let html = "";
  let errorMessage: string | null = null;

  try {
    const reportData = await loadPerformanceReportDocumentData(supabase, id, variant, {
      publicationIds,
    });
    html = renderPerformanceReportHtml(reportData);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to render performance report preview.";
  }

  const variantLabel = variant === "influencers" ? "Influencer" : "Combined";

  return (
    <DashboardShell
      title="Performance report preview"
      description={`${typed.document_number ?? typed.name} — ${variantLabel.toLowerCase()} client report`}
      hidePageHeader
    >
      <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:-mx-8 md:px-8 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <PageBackButton
              fallbackHref={`/campaigns/${id}?tab=publications`}
              label="Back to Performance Center"
              variant="text"
            />
            <Suspense fallback={null}>
              <PerformanceReportPreviewVariantToggle campaignId={id} activeVariant={variant} />
            </Suspense>
          </div>
          {!errorMessage ? (
            <PerformanceReportPreviewDownloads
              campaignId={id}
              variant={variant}
              publicationIds={publicationIds}
            />
          ) : null}
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : (
        <iframe
          title={`${variantLabel} performance report ${typed.document_number ?? id}`}
          srcDoc={html}
          className="min-h-[1200px] w-full rounded-xl border border-border bg-card"
        />
      )}
    </DashboardShell>
  );
}
