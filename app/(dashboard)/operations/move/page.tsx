import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoveBetweenAccountsWorkspace } from "@/features/operations/components/move-between-accounts-workspace";
import { VendorMovementWorkspace } from "@/features/operations/components/vendor-movement-workspace";
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
    <DashboardShell
      title="Move between accounts"
      description="Enterprise reassignment — hierarchy ownership and creator assignment transfers with full audit preservation."
    >
      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : hierarchy && campaignsResult && vendors ? (
        <Tabs defaultValue={vendorParam ? "vendor" : "hierarchy"} className="space-y-4">
          <TabsList>
            <TabsTrigger value="hierarchy">Group / Client / Brand</TabsTrigger>
            <TabsTrigger value="vendor">Vendor reassignment</TabsTrigger>
          </TabsList>
          <TabsContent value="hierarchy">
            <MoveBetweenAccountsWorkspace
              hierarchy={hierarchy}
              initialCampaigns={campaignsResult.campaigns}
              initialTotal={campaignsResult.total}
            />
          </TabsContent>
          <TabsContent value="vendor">
            <VendorMovementWorkspace
              vendors={vendors}
              initialSourceVendorId={vendorParam ?? ""}
              initialAssignments={initialAssignments}
            />
          </TabsContent>
        </Tabs>
      ) : null}
    </DashboardShell>
  );
}
