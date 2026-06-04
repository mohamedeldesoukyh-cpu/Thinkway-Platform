import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { VendorPortalAccessCard } from "@/features/vendors/components/vendor-portal-access-card";
import { VendorWorkspaceView } from "@/features/vendors/components/vendor-workspace";
import { getVendorWorkspace } from "@/features/vendors/queries";

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
  let errorMessage: string | null = null;

  try {
    workspace = await getVendorWorkspace(id);
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
      description="Enterprise creator profile — platforms, assignments, billing, and audit."
    >
      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : workspace ? (
        <VendorWorkspaceView
          workspace={workspace}
          defaultTab={tab ?? "overview"}
          portalAccessPanel={
            <VendorPortalAccessCard
              influencerId={workspace.id}
              profileId={workspace.profile_id}
            />
          }
        />
      ) : null}
    </DashboardShell>
  );
}
