"use client";

import { useMemo } from "react";

import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS,
  OperationalWorkspaceSortableTabsBar,
  OperationalWorkspaceTabPanel,
  type OperationalWorkspaceTabDef,
} from "@/components/workspace/operational-workspace-ui";
import { useWorkspaceTabOrder } from "@/hooks/use-workspace-tab-order";
import { MoveBetweenAccountsWorkspace } from "@/features/operations/components/move-between-accounts-workspace";
import { VendorMovementWorkspace } from "@/features/operations/components/vendor-movement-workspace";
import {
  MOVE_OPERATIONS_TAB_ORDER,
  MOVE_OPERATIONS_TAB_STORAGE_KEY,
  isMoveOperationsTabId,
  type MoveOperationsTabId,
} from "@/lib/workspace/platform-workspace-tabs";
import type {
  getCampaignsForMovement,
  getHierarchyOptions,
  getVendorAssignmentsForMovement,
  getVendorsForMovement,
} from "@/features/operations/queries";

type MoveOperationsTabsProps = {
  hierarchy: Awaited<ReturnType<typeof getHierarchyOptions>>;
  campaignsResult: Awaited<ReturnType<typeof getCampaignsForMovement>>;
  vendors: Awaited<ReturnType<typeof getVendorsForMovement>>;
  initialAssignments: Awaited<ReturnType<typeof getVendorAssignmentsForMovement>>;
  vendorParam?: string;
};

export function MoveOperationsTabs({
  hierarchy,
  campaignsResult,
  vendors,
  initialAssignments,
  vendorParam,
}: MoveOperationsTabsProps) {
  const defaultTab = vendorParam ? "vendor" : "hierarchy";

  const { tabOrder, moveTab } = useWorkspaceTabOrder({
    storageKey: MOVE_OPERATIONS_TAB_STORAGE_KEY,
    defaultOrder: MOVE_OPERATIONS_TAB_ORDER,
    isValidId: isMoveOperationsTabId,
  });

  const tabsById = useMemo(
    (): Record<MoveOperationsTabId, OperationalWorkspaceTabDef> => ({
      hierarchy: { value: "hierarchy", label: "Group / Client / Brand" },
      vendor: { value: "vendor", label: "Vendor reassignment" },
    }),
    []
  );

  return (
    <Tabs defaultValue={defaultTab} className="flex flex-col gap-0">
      <OperationalWorkspaceSortableTabsBar
        sectionLabel="Move between accounts"
        tabOrder={tabOrder}
        tabsById={tabsById}
        onReorder={moveTab}
      />
      <TabsContent value="hierarchy" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
        <OperationalWorkspaceTabPanel>
          <MoveBetweenAccountsWorkspace
            hierarchy={hierarchy}
            initialCampaigns={campaignsResult.campaigns}
            initialTotal={campaignsResult.total}
          />
        </OperationalWorkspaceTabPanel>
      </TabsContent>
      <TabsContent value="vendor" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
        <OperationalWorkspaceTabPanel>
          <VendorMovementWorkspace
            vendors={vendors}
            initialSourceVendorId={vendorParam ?? ""}
            initialAssignments={initialAssignments}
          />
        </OperationalWorkspaceTabPanel>
      </TabsContent>
    </Tabs>
  );
}
