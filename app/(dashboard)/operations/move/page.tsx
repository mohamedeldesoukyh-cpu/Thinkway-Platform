import { DashboardShell } from "@/components/layout/dashboard-shell";
import { FinanceSuiteRoot } from "@/components/finance/suite";
import { MoveOperationsTabs } from "@/features/operations/components/move-operations-tabs";
import {
  getCampaignsForMovement,
  getHierarchyOptions,
  getVendorAssignmentsForMovement,
  getVendorsForMovement,
} from "@/features/operations/queries";

type MovePageProps = {
  searchParams: Promise<{ vendor?: string }>;
};

export default async function MoveBetweenAccountsPage({
  searchParams,
}: MovePageProps) {
  const { vendor: vendorParam } = await searchParams;
  let hierarchy;
  let campaignsResult;
  let vendors;
  let initialAssignments: Awaited<
    ReturnType<typeof getVendorAssignmentsForMovement>
  > = [];
  let errorMessage: string | null = null;

  try {
    [hierarchy, campaignsResult, vendors] = await Promise.all([
      getHierarchyOptions(),
      getCampaignsForMovement({ movementType: "brand_to_brand", pageSize: 50 }),
      getVendorsForMovement(),
    ]);
    if (vendorParam) {
      initialAssignments = await getVendorAssignmentsForMovement(vendorParam);
    }
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load operations workspace.";
  }

  return (
    <FinanceSuiteRoot>
      <DashboardShell
        title="Move between accounts"
        description="Enterprise reassignment — hierarchy ownership and creator assignment transfers with full audit preservation."
      >
        {errorMessage ? (
          <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : hierarchy && campaignsResult && vendors ? (
          <MoveOperationsTabs
            hierarchy={hierarchy}
            campaignsResult={campaignsResult}
            vendors={vendors}
            initialAssignments={initialAssignments}
            vendorParam={vendorParam}
          />
        ) : null}
      </DashboardShell>
    </FinanceSuiteRoot>
  );
}
