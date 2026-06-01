import { DashboardShell } from "@/components/layout/dashboard-shell";
import { MoveBetweenAccountsWorkspace } from "@/features/operations/components/move-between-accounts-workspace";
import {
  getCampaignsForMovement,
  getHierarchyOptions,
} from "@/features/operations/queries";

export default async function MoveBetweenAccountsPage() {
  let hierarchy;
  let campaignsResult;
  let errorMessage: string | null = null;

  try {
    [hierarchy, campaignsResult] = await Promise.all([
      getHierarchyOptions(),
      getCampaignsForMovement({ movementType: "brand_to_brand", pageSize: 50 }),
    ]);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load operations workspace.";
  }

  return (
    <DashboardShell
      title="Move between accounts"
      description="Enterprise campaign reassignment — restructure ownership while preserving billing, invoices, and audit history."
    >
      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : hierarchy && campaignsResult ? (
        <MoveBetweenAccountsWorkspace
          hierarchy={hierarchy}
          initialCampaigns={campaignsResult.campaigns}
          initialTotal={campaignsResult.total}
        />
      ) : null}
    </DashboardShell>
  );
}
