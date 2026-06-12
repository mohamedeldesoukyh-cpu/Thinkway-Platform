import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { VendorPortalAccessCard } from "@/features/vendors/components/vendor-portal-access-card";
import { VendorWorkspaceView } from "@/features/vendors/components/vendor-workspace";
import { getVendorWorkspace } from "@/features/vendors/queries";
import { buildCurrencyOptions } from "@/lib/master-data/currency-options";
import { getMasterDataOptions } from "@/lib/master-data/queries";

type VendorProfilePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function VendorProfilePage({
  params,
  searchParams,
}: VendorProfilePageProps) {
  const { id } = await params;
  const { tab } = await searchParams;

  let workspace;
  let currencyOptions: { value: string; label: string }[] = [];
  let errorMessage: string | null = null;

  try {
    const [workspaceResult, masterData] = await Promise.all([
      getVendorWorkspace(id),
      getMasterDataOptions(),
    ]);
    workspace = workspaceResult;
    currencyOptions = buildCurrencyOptions(masterData.currencies);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load vendor.";
  }

  if (!workspace && !errorMessage) {
    notFound();
  }

  return (
    <DashboardShell
      title="Creator workspace"
      hidePageHeader
      containedMain
      mainClassName="min-h-0 flex-1 flex-col p-3 md:px-6 md:py-4"
    >
      {errorMessage ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[11px] text-destructive">
          {errorMessage}
        </div>
      ) : workspace ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <VendorWorkspaceView
            workspace={workspace}
            defaultTab={tab ?? "overview"}
            currencyOptions={currencyOptions}
            portalAccessPanel={
              <VendorPortalAccessCard
                influencerId={workspace.id}
                profileId={workspace.profile_id}
              />
            }
          />
        </div>
      ) : null}
    </DashboardShell>
  );
}
