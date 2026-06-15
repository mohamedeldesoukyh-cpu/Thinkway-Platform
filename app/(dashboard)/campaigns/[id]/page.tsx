import { notFound } from "next/navigation";

import { PageBackButton } from "@/components/navigation/page-back-button";
import { PageAlert } from "@/components/ui/page-alert";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CampaignWorkspaceView } from "@/features/campaigns/components/campaign-workspace";
import { getCampaignWorkspace } from "@/features/campaigns/queries";
import { getCampaignAssignmentHierarchy } from "@/features/campaigns/queries/assignment-hierarchy";
import { toPlainAssignmentHierarchy } from "@/lib/campaigns/serialize-assignment-hierarchy";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { devLog } from "@/lib/dev-log";
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
import { isUuid } from "@/lib/validation/uuid";
import {
  resolveCampaignWorkspaceTab,
} from "@/features/campaigns/constants/campaign-workspace-tab-order";

type CampaignWorkspacePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function CampaignWorkspacePage({
  params,
  searchParams,
}: CampaignWorkspacePageProps) {
  const { id } = await params;
  const { tab } = await searchParams;
  const defaultTab = resolveCampaignWorkspaceTab(tab);

  if (!isUuid(id)) {
    return (
      <DashboardShell
        title="Campaign workspace"
        description="Operational command center for lines, vendors, deliverables, billing, and workflow."
      >
        <div className="space-y-4 rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-sm">
          <p className="font-medium text-destructive">Invalid campaign link</p>
          <p className="text-muted-foreground">
            The URL does not contain a valid campaign ID. Open a campaign from the{" "}
            <strong>Campaigns</strong> list instead of using a bookmark or preview link.
          </p>
          <PageBackButton
            fallbackHref="/campaigns"
            label="Back to campaigns"
            variant="text"
          />
        </div>
      </DashboardShell>
    );
  }

  let workspace;
  let assignmentHierarchy;
  let errorMessage: string | null = null;

  try {
    workspace = await getCampaignWorkspace(id);
    if (workspace) {
      assignmentHierarchy = toPlainAssignmentHierarchy(
        await getCampaignAssignmentHierarchy(id, workspace)
      );
    }
  } catch (error) {
    const { logCampaignWorkspaceLoadError } = await import(
      "@/lib/billing/operational-billing-trace"
    );
    logCampaignWorkspaceLoadError("getCampaignWorkspace", error, { campaignId: id });
    errorMessage =
      error instanceof Error ? error.message : "Failed to load campaign workspace.";
  }

  if (!workspace && !errorMessage) {
    notFound();
  }

  if (workspace && isBillingRepairOnLoadEnabled()) {
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user: repairUser },
      } = await supabase.auth.getUser();
      await repairNonIoInvoiceLineItemsForCampaign(supabase, id);
      await repairLinesBillingWithoutVendorIo(supabase, id);
      await repairOrphanedInvoicedOperationalRows(supabase, id);
      await repairDesyncedUngeneratedInvoiceHeaders(supabase, id);
      await repairStalePendingRegenerationInvoices(supabase, id);
      await repairIncorrectlyFinanceLockedDraftInvoices(supabase, id);
      await repairActiveInvoiceOperationalRelock(supabase, id);
      await repairAppendMissingInvoiceLineItems(supabase, id);
      const { prepareCampaignCommercialForInvoice } = await import(
        "@/lib/billing/repair-invoice-create-pipeline"
      );
      await prepareCampaignCommercialForInvoice(supabase, id);
      await repairVendorIoAmountDrift(supabase, id, repairUser?.id ?? null);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        devLog("[campaign-page] orphaned invoice repair skipped", error);
      }
    }
  }

  if (!workspace && !errorMessage) {
    notFound();
  }

  return (
    <DashboardShell
      title="Campaign workspace"
      hidePageHeader
      containedMain
      mainClassName="min-h-0 flex-1 flex-col p-3 md:px-6 md:py-4"
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
