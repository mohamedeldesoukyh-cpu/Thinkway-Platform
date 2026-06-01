import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CampaignWorkspaceView } from "@/features/campaigns/components/campaign-workspace";
import {
  getCampaignFormOptions,
  getCampaignWorkspace,
} from "@/features/campaigns/queries";
import { getCampaignBillingLines } from "@/features/billing/queries";
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
  let errorMessage: string | null = null;

  try {
    [workspace, formOptions, masterData, billingLines] = await Promise.all([
      getCampaignWorkspace(id),
      getCampaignFormOptions(),
      getMasterDataOptions(),
      getCampaignBillingLines(id),
    ]);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load campaign workspace.";
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
          currencyOptions={currencyOptions}
        />
      ) : null}
    </DashboardShell>
  );
}
