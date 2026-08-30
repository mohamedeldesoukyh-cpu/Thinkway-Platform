import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { VendorPortalAccessCard } from "@/features/vendors/components/vendor-portal-access-card";
import { VendorWorkspaceView } from "@/features/vendors/components/vendor-workspace";
import { getVendorWorkspace } from "@/features/vendors/queries";
import { buildCurrencyOptions } from "@/lib/master-data/currency-options";
import { getMasterDataOptions } from "@/lib/master-data/queries";
import { vendorDetailPath } from "@/lib/routing/entity-paths";
import {
  metadataTitleForEntity,
  redirectToCanonicalEntityRoute,
} from "@/lib/routing/entity-page";
import {
  fetchVendorRouteSummary,
  resolveVendorIdByRouteKey,
} from "@/lib/routing/entity-route-queries";

type VendorProfilePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export async function generateMetadata({
  params,
}: Pick<VendorProfilePageProps, "params">): Promise<Metadata> {
  const { id: routeKey } = await params;
  const vendorId = await resolveVendorIdByRouteKey(routeKey);
  if (!vendorId) return { title: "Creator" };

  const summary = await fetchVendorRouteSummary(vendorId);
  if (!summary) return { title: "Creator" };

  return {
    title: metadataTitleForEntity(summary, summary.document_number),
  };
}

export default async function VendorProfilePage({
  params,
  searchParams,
}: VendorProfilePageProps) {
  const { id: routeKey } = await params;
  const { tab } = await searchParams;

  const vendorId = await resolveVendorIdByRouteKey(routeKey);
  if (!vendorId) notFound();

  const routeSummary = await fetchVendorRouteSummary(vendorId);
  if (routeSummary) {
    redirectToCanonicalEntityRoute({
      routeKey,
      entity: routeSummary,
      canonicalPath: vendorDetailPath(routeSummary),
    });
  }

  let workspace;
  let currencyOptions: { value: string; label: string }[] = [];
  let errorMessage: string | null = null;

  try {
    const [workspaceResult, masterDataResult] = await Promise.allSettled([
      getVendorWorkspace(vendorId),
      getMasterDataOptions(),
    ]);

    if (workspaceResult.status === "fulfilled") {
      workspace = workspaceResult.value;
    } else {
      errorMessage =
        workspaceResult.reason instanceof Error
          ? workspaceResult.reason.message
          : "Failed to load vendor.";
    }

    if (masterDataResult.status === "fulfilled") {
      currencyOptions = buildCurrencyOptions(masterDataResult.value.currencies);
    }
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load vendor.";
  }

  if (!workspace && !errorMessage) {
    notFound();
  }

  return (
    <DashboardShell
      title="Creator Profile"
      hidePageHeader
      platformV6
      containedMain
      mainClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
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
