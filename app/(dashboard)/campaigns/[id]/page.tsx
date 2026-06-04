import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PageAlert } from "@/components/ui/page-alert";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CampaignWorkspaceView } from "@/features/campaigns/components/campaign-workspace";
import {
  getCampaignFormOptions,
  getCampaignWorkspace,
} from "@/features/campaigns/queries";
import { getCampaignBillingGroups, getCampaignBillingLines, getCampaignOperationalBillingDetail } from "@/features/billing/queries";
import { getFinanceInvoiceRegister } from "@/features/finance/invoices/queries";
import { getCampaignAssignmentHierarchy } from "@/features/campaigns/queries/assignment-hierarchy";
import { logAssignmentsStage } from "@/lib/campaigns/assignments-render-log";
import {
  assignmentsRenderStageSourceLabel,
  resolveAssignmentsRenderStage,
} from "@/lib/campaigns/assignments-render-stage";
import { toPlainAssignmentHierarchy } from "@/lib/campaigns/serialize-assignment-hierarchy";
import { getCampaignPublications } from "@/features/campaigns/queries/publications";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { EMPTY_CAMPAIGN_FORM_OPTIONS } from "@/features/campaigns/campaign-page-fallbacks";
import { buildCurrencyOptions } from "@/lib/master-data/currency-options";
import { getMasterDataOptions } from "@/lib/master-data/queries";
import { devLog } from "@/lib/dev-log";
import { isUuid } from "@/lib/validation/uuid";

type CampaignWorkspacePageProps = {
  params: Promise<{ id: string }>;
};

export default async function CampaignWorkspacePage({
  params,
}: CampaignWorkspacePageProps) {
  const { id } = await params;

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
          <Button variant="outline" size="sm" asChild>
            <Link href="/campaigns">Back to campaigns</Link>
          </Button>
        </div>
      </DashboardShell>
    );
  }

  let workspace;
  let formOptions: Awaited<ReturnType<typeof getCampaignFormOptions>> | null =
    null;
  let masterData: Awaited<ReturnType<typeof getMasterDataOptions>> | null =
    null;
  let billingLines: Awaited<ReturnType<typeof getCampaignBillingLines>> = [];
  let billingGroups: Awaited<ReturnType<typeof getCampaignBillingGroups>> = [];
  let operationalBilling: Awaited<ReturnType<typeof getCampaignOperationalBillingDetail>> = null;
  let assignmentHierarchy: Awaited<ReturnType<typeof getCampaignAssignmentHierarchy>> = {
    groups: [],
    currency_code: "USD",
    load_error: null,
  };
  let publications: Awaited<ReturnType<typeof getCampaignPublications>>["publications"] =
    [];
  let publicationsLoadError: string | null = null;
  let campaignInvoiceRegister: Awaited<ReturnType<typeof getFinanceInvoiceRegister>> = [];
  let errorMessage: string | null = null;

  try {
    workspace = await getCampaignWorkspace(id);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load campaign workspace.";
  }

  if (!workspace && !errorMessage) {
    notFound();
  }

  if (workspace) {
    const settled = await Promise.allSettled([
      getCampaignFormOptions(),
      getMasterDataOptions(),
      getCampaignBillingLines(id),
      getCampaignBillingGroups(id),
    ]);

    if (settled[0].status === "fulfilled") {
      formOptions = settled[0].value;
    } else {
      formOptions = EMPTY_CAMPAIGN_FORM_OPTIONS;
      if (process.env.NODE_ENV === "development") {
        devLog("[dashboard-resilience] campaign form options fallback", settled[0].reason);
      }
    }

    if (settled[1].status === "fulfilled") {
      masterData = settled[1].value;
    }
    if (settled[2].status === "fulfilled") {
      billingLines = settled[2].value;
    } else if (process.env.NODE_ENV === "development") {
      devLog("[dashboard-resilience] campaign billing lines fallback", settled[2].reason);
    }
    if (settled[3].status === "fulfilled") {
      billingGroups = settled[3].value;
    }

    try {
      campaignInvoiceRegister = await getFinanceInvoiceRegister({
        campaignHeaderId: id,
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        devLog("[campaign-page] campaign invoice register fallback", error);
      }
    }

    try {
      operationalBilling = await getCampaignOperationalBillingDetail(id);
    } catch (error) {
      console.error("[campaign-page] operational billing load failed", {
        campaignId: id,
        error: error instanceof Error ? error.message : error,
      });
    }

    try {
      const loaded = await getCampaignAssignmentHierarchy(id);
      assignmentHierarchy = toPlainAssignmentHierarchy(loaded);
      logAssignmentsStage("page query success", {
        campaignId: id,
        groupCount: assignmentHierarchy.groups.length,
        skipped: assignmentHierarchy.skipped_line_ids?.length ?? 0,
        loadError: assignmentHierarchy.load_error ?? null,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load assignment hierarchy.";
      console.error("[Assignments] page hierarchy query failed", { campaignId: id, message });
      assignmentHierarchy = {
        groups: [],
        currency_code: workspace.currency_code,
        load_error: message,
        skipped_line_ids: [],
        sanitize_warnings: [],
      };
    }

    try {
      const publicationResult = await getCampaignPublications(id);
      publications = publicationResult.publications;
      publicationsLoadError = publicationResult.load_error;
    } catch (error) {
      publicationsLoadError =
        error instanceof Error ? error.message : "Failed to load publications.";
      console.error("[campaign-page] publications failed", { campaignId: id, publicationsLoadError });
    }
  }

  if (!workspace && !errorMessage) {
    notFound();
  }

  const teams = masterData?.teams ?? [];
  const currencyOptions = buildCurrencyOptions(masterData?.currencies ?? []);
  const resolved = resolveAssignmentsRenderStage();

  logAssignmentsStage("page render stage resolved", {
    campaignId: id,
    stage: resolved.stage,
    requestedStage: resolved.requestedStage,
    source: resolved.source,
    envLabel: assignmentsRenderStageSourceLabel(
      resolved.source,
      resolved.requestedStage
    ),
    showBanner: resolved.showRenderStageBanner,
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  });

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
              accountManagers={
                (formOptions ?? EMPTY_CAMPAIGN_FORM_OPTIONS).accountManagers
              }
              teams={teams}
              billingLines={billingLines}
              billingGroups={billingGroups}
              operationalBilling={operationalBilling}
              campaignInvoiceRegister={campaignInvoiceRegister}
              assignmentHierarchy={assignmentHierarchy}
              publications={publications}
              publicationsLoadError={publicationsLoadError}
              currencyOptions={currencyOptions}
              assignmentsRenderStage={resolved.stage}
              assignmentsRenderStageSource={resolved.source}
              assignmentsRequestedRenderStage={resolved.requestedStage}
              showAssignmentsRenderStageBanner={resolved.showRenderStageBanner}
            />
          </div>
        </PlatformErrorBoundary>
      ) : null}
    </DashboardShell>
  );
}
