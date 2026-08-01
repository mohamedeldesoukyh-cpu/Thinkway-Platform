import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PageBackButton } from "@/components/navigation/page-back-button";
import { PageAlert } from "@/components/ui/page-alert";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CampaignWorkspaceView } from "@/features/campaigns/components/campaign-workspace";
import { getCampaignWorkspace } from "@/features/campaigns/queries";
import { getCampaignAssignmentHierarchy } from "@/features/campaigns/queries/assignment-hierarchy";
import { toPlainAssignmentHierarchy } from "@/lib/campaigns/serialize-assignment-hierarchy";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { devLog } from "@/lib/dev-log";
import { traceCampaignRoute, traceCampaignRouteError } from "@/lib/performance/campaign-route-trace";
import { isBillingRepairOnLoadEnabled } from "@/lib/billing/billing-repair-on-load";
import {
  repairActiveInvoiceOperationalRelock,
  repairLinesBillingWithoutVendorIo,
  repairNonIoInvoiceLineItemsForCampaign,
  repairAppendMissingInvoiceLineItems,
  repairDesyncedUngeneratedInvoiceHeaders,
  repairIncorrectlyFinanceLockedDraftInvoices,
  repairOrphanedInvoicedOperationalRows,
  repairStalePendingRegenerationInvoices,
} from "@/lib/billing/repair-orphaned-invoice-state";
import { repairVendorIoAmountDrift } from "@/lib/io/repair-vendor-io-amount-drift";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  resolveCampaignWorkspaceTab,
} from "@/features/campaigns/constants/campaign-workspace-tab-order";
import {
  campaignProcessCueFromWorkspace,
} from "@/features/campaigns/lifecycle/campaign-process-presentation";
import { resolveBareCampaignEntryRedirect } from "@/features/campaigns/lifecycle/campaign-workspace-entry-routing";
import { campaignDetailPath, campaignDetailPathWithTab } from "@/lib/routing/entity-paths";
import {
  metadataTitleForEntity,
  redirectToCanonicalEntityRoute,
} from "@/lib/routing/entity-page";
import {
  fetchCampaignRouteSummary,
  resolveCampaignIdByRouteKey,
} from "@/lib/routing/entity-route-queries";

type CampaignWorkspacePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export async function generateMetadata({
  params,
}: Pick<CampaignWorkspacePageProps, "params">): Promise<Metadata> {
  const { id: routeKey } = await params;
  const campaignId = await resolveCampaignIdByRouteKey(routeKey);
  if (!campaignId) return { title: "Campaign" };

  const summary = await fetchCampaignRouteSummary(campaignId);
  if (!summary) return { title: "Campaign" };

  return {
    title: metadataTitleForEntity(summary, summary.document_number),
  };
}

export default async function CampaignWorkspacePage({
  params,
  searchParams,
}: CampaignWorkspacePageProps) {
  const { id: routeKey } = await params;
  const { tab } = await searchParams;

  const campaignId = await resolveCampaignIdByRouteKey(routeKey);
  if (!campaignId) notFound();

  const routeSummary = await fetchCampaignRouteSummary(campaignId);
  if (routeSummary) {
    redirectToCanonicalEntityRoute(
      {
        routeKey,
        entity: routeSummary,
        canonicalPath: campaignDetailPath(routeSummary),
      },
      undefined,
      tab ? { tab } : undefined
    );
  }

  let workspace;
  let assignmentHierarchy;
  let errorMessage: string | null = null;

  traceCampaignRoute("page:load:start", { campaignId, tab: tab ?? null });

  try {
    workspace = await getCampaignWorkspace(campaignId);
    traceCampaignRoute("page:workspace:loaded", {
      campaignId,
      found: Boolean(workspace),
    });
    if (workspace) {
      assignmentHierarchy = toPlainAssignmentHierarchy(
        await getCampaignAssignmentHierarchy(campaignId, workspace)
      );
      traceCampaignRoute("page:assignment-hierarchy:loaded", {
        campaignId,
        groupCount: assignmentHierarchy.groups?.length ?? 0,
        loadError: assignmentHierarchy.load_error ?? null,
      });
    }
  } catch (error) {
    traceCampaignRouteError("page:load:failed", error, { campaignId });
    const { logCampaignWorkspaceLoadError } = await import(
      "@/lib/billing/operational-billing-trace"
    );
    logCampaignWorkspaceLoadError("getCampaignWorkspace", error, { campaignId });
    if (process.env.NODE_ENV === "development") {
      throw error;
    }
    errorMessage =
      error instanceof Error ? error.message : "Failed to load campaign workspace.";
  }

  // Lifecycle OS: bare /campaigns/[id] (no ?tab=) enters the recommended business stage.
  // Any explicit ?tab= must stay — never bounce the user away from a chosen workspace.
  // Keep outside try/catch so redirect() is not swallowed.
  if (workspace) {
    const entryStage = campaignProcessCueFromWorkspace(workspace).entryStageId;
    const redirectTab = resolveBareCampaignEntryRedirect(tab, entryStage);
    if (redirectTab) {
      redirect(campaignDetailPathWithTab(workspace, redirectTab));
    }
  }

  if (!workspace && !errorMessage) {
    traceCampaignRoute("page:not-found", { campaignId, reason: "workspace-null" });
    notFound();
  }

  if (workspace && isBillingRepairOnLoadEnabled()) {
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user: repairUser },
      } = await supabase.auth.getUser();
      await repairNonIoInvoiceLineItemsForCampaign(supabase, campaignId);
      await repairLinesBillingWithoutVendorIo(supabase, campaignId);
      await repairOrphanedInvoicedOperationalRows(supabase, campaignId);
      await repairDesyncedUngeneratedInvoiceHeaders(supabase, campaignId);
      await repairStalePendingRegenerationInvoices(supabase, campaignId);
      await repairIncorrectlyFinanceLockedDraftInvoices(supabase, campaignId);
      await repairActiveInvoiceOperationalRelock(supabase, campaignId);
      await repairAppendMissingInvoiceLineItems(supabase, campaignId);
      const { prepareCampaignCommercialForInvoice } = await import(
        "@/lib/billing/repair-invoice-create-pipeline"
      );
      await prepareCampaignCommercialForInvoice(supabase, campaignId);
      await repairVendorIoAmountDrift(supabase, campaignId, repairUser?.id ?? null);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        devLog("[campaign-page] orphaned invoice repair skipped", error);
      }
    }
  }

  const defaultTab = resolveCampaignWorkspaceTab(tab);

  return (
    <DashboardShell
      title="Campaign workspace"
      hidePageHeader
      containedMain
      mainClassName="min-h-0 flex-1 flex-col overflow-hidden p-0 md:p-0"
    >
      {errorMessage ? (
        <PageAlert>{errorMessage}</PageAlert>
      ) : workspace ? (
        <PlatformErrorBoundary surface="campaigns">
          <div className="flex min-h-0 flex-1 flex-col">
            <CampaignWorkspaceView
              workspace={workspace}
              defaultTab={defaultTab}
              initialAssignmentHierarchy={assignmentHierarchy!}
            />
          </div>
        </PlatformErrorBoundary>
      ) : null}
    </DashboardShell>
  );
}
