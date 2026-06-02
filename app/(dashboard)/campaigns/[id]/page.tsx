import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CampaignWorkspaceView } from "@/features/campaigns/components/campaign-workspace";
import {
  getCampaignFormOptions,
  getCampaignWorkspace,
} from "@/features/campaigns/queries";
import { getCampaignBillingGroups, getCampaignBillingLines } from "@/features/billing/queries";
import { getCampaignAssignmentHierarchy } from "@/features/campaigns/queries/assignment-hierarchy";
import { getCampaignPublications } from "@/features/campaigns/queries/publications";
import { buildCurrencyOptions } from "@/lib/master-data/currency-options";
import { getMasterDataOptions } from "@/lib/master-data/queries";

type CampaignWorkspacePageProps = {
  params: Promise<{ id: string }>;
};

export default async function CampaignWorkspacePage({
  params,
}: CampaignWorkspacePageProps) {
  const { id } = await params;

  let workspace;
  let formOptions: Awaited<ReturnType<typeof getCampaignFormOptions>> | null =
    null;
  let masterData: Awaited<ReturnType<typeof getMasterDataOptions>> | null =
    null;
  let billingLines: Awaited<ReturnType<typeof getCampaignBillingLines>> = [];
  let billingGroups: Awaited<ReturnType<typeof getCampaignBillingGroups>> = [];
  let assignmentHierarchy: Awaited<ReturnType<typeof getCampaignAssignmentHierarchy>> = {
    groups: [],
    currency_code: "USD",
    load_error: null,
  };
  let publications: Awaited<ReturnType<typeof getCampaignPublications>>["publications"] =
    [];
  let publicationsLoadError: string | null = null;
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
    try {
      [formOptions, masterData, billingLines, billingGroups] = await Promise.all([
        getCampaignFormOptions(),
        getMasterDataOptions(),
        getCampaignBillingLines(id),
        getCampaignBillingGroups(id),
      ]);
    } catch (error) {
      console.error("[campaign-page] secondary data load failed", error);
    }

    try {
      assignmentHierarchy = await getCampaignAssignmentHierarchy(id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load assignment hierarchy.";
      console.error("[campaign-page] assignment hierarchy failed", { campaignId: id, message });
      assignmentHierarchy = {
        groups: [],
        currency_code: workspace.currency_code,
        load_error: message,
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

  return (
    <DashboardShell
      title="Campaign workspace"
      description="Operational command center for lines, vendors, deliverables, billing, and workflow."
    >
      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : workspace && formOptions ? (
        <CampaignWorkspaceView
          workspace={workspace}
          accountManagers={formOptions.accountManagers}
          teams={teams}
          billingLines={billingLines}
          billingGroups={billingGroups}
          assignmentHierarchy={assignmentHierarchy}
          publications={publications}
          publicationsLoadError={publicationsLoadError}
          currencyOptions={currencyOptions}
        />
      ) : null}
    </DashboardShell>
  );
}
