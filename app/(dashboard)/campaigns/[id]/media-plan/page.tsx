import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CampaignMediaPlanWorkspace } from "@/features/campaigns/components/media-plan/campaign-media-plan-workspace";
import { getCampaignWorkspace } from "@/features/campaigns/queries";
import { loadCampaignMediaPlanWorkspace } from "@/features/campaigns/queries/load-campaign-media-plan";
import type { MediaPlanViewKind } from "@/lib/media-plan";
import {
  metadataTitleForEntity,
  redirectToCanonicalEntityRoute,
} from "@/lib/routing/entity-page";
import { campaignMediaPlanPath } from "@/lib/routing/entity-paths";
import {
  fetchCampaignRouteSummary,
  resolveCampaignIdByRouteKey,
} from "@/lib/routing/entity-route-queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type CampaignMediaPlanPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; planId?: string }>;
};

function resolveView(raw: string | undefined): MediaPlanViewKind {
  if (raw === "actual" || raw === "remaining") return raw;
  return "original";
}

export async function generateMetadata({
  params,
}: Pick<CampaignMediaPlanPageProps, "params">): Promise<Metadata> {
  const { id: routeKey } = await params;
  const campaignId = await resolveCampaignIdByRouteKey(routeKey);
  if (!campaignId) return { title: "Media Plan" };

  const summary = await fetchCampaignRouteSummary(campaignId);
  if (!summary) return { title: "Media Plan" };

  return {
    title: `Media Plan · ${metadataTitleForEntity(summary, summary.document_number)}`,
  };
}

export default async function CampaignMediaPlanPage({
  params,
  searchParams,
}: CampaignMediaPlanPageProps) {
  const { id: routeKey } = await params;
  const query = await searchParams;
  const view = resolveView(query.view);
  const selectedPlanId = query.planId?.trim() || null;

  const campaignId = await resolveCampaignIdByRouteKey(routeKey);
  if (!campaignId) notFound();

  const routeSummary = await fetchCampaignRouteSummary(campaignId);
  if (routeSummary) {
    redirectToCanonicalEntityRoute(
      {
        routeKey,
        entity: routeSummary,
        canonicalPath: campaignMediaPlanPath(routeSummary),
      },
      undefined,
      view !== "original" ? { view } : undefined
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const workspace = await getCampaignWorkspace(campaignId);
  if (!workspace) notFound();

  const payload = await loadCampaignMediaPlanWorkspace(supabase, workspace, {
    selectedPlanId,
  });

  return (
    <DashboardShell
      title="Media Plan"
      description={`${workspace.document_number ?? workspace.name} — Original, Actual, Remaining`}
      hidePageHeader
    >
      <CampaignMediaPlanWorkspace
        workspace={workspace}
        payload={payload}
        initialView={view}
      />
    </DashboardShell>
  );
}
