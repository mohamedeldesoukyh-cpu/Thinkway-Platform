"use client";

import { useMemo } from "react";

import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS,
  OperationalWorkspaceChrome,
  OperationalWorkspaceSortableTabsBar,
  OperationalWorkspaceTabPanel,
  type OperationalWorkspaceTabDef,
} from "@/components/workspace/operational-workspace-ui";
import { PageBackButton } from "@/components/navigation/page-back-button";
import { DocumentNumber } from "@/components/ui/document-number";
import { useWorkspaceTabOrder } from "@/hooks/use-workspace-tab-order";
import {
  VENDOR_PROFILE_TAB_ORDER,
  VENDOR_PROFILE_TAB_STORAGE_KEY,
  isVendorProfileTabId,
  type VendorProfileTabId,
} from "@/lib/workspace/platform-workspace-tabs";
import type { VendorDetail } from "@/types/database";

import { VendorStatusBadge } from "./vendor-status-badge";
import { VendorCampaignsTab } from "./tabs/vendor-campaigns-tab";
import { VendorDocumentsTab } from "./tabs/vendor-documents-tab";
import { VendorFinanceTab } from "./tabs/vendor-finance-tab";
import { VendorLegalTab } from "./tabs/vendor-legal-tab";
import { VendorOverviewTab } from "./tabs/vendor-overview-tab";
import { VendorPlatformsTab } from "./tabs/vendor-platforms-tab";

type VendorProfileProps = {
  vendor: VendorDetail;
};

export function VendorProfile({ vendor }: VendorProfileProps) {
  const { tabOrder, moveTab } = useWorkspaceTabOrder({
    storageKey: VENDOR_PROFILE_TAB_STORAGE_KEY,
    defaultOrder: VENDOR_PROFILE_TAB_ORDER,
    isValidId: isVendorProfileTabId,
  });

  const tabsById = useMemo(
    (): Record<VendorProfileTabId, OperationalWorkspaceTabDef> => ({
      overview: { value: "overview", label: "Overview" },
      legal: { value: "legal", label: "Legal" },
      finance: { value: "finance", label: "Finance" },
      documents: { value: "documents", label: "Documents" },
      platforms: { value: "platforms", label: "Platforms" },
      campaigns: {
        value: "campaigns",
        label: "Campaign history",
        count: vendor.campaign_assignments.length,
      },
    }),
    [vendor.campaign_assignments.length]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0">
      <OperationalWorkspaceChrome
        backButton={
          <PageBackButton fallbackHref="/vendors" label="Back to vendors" />
        }
        title={vendor.display_name}
        badges={<VendorStatusBadge status={vendor.status} />}
        meta={<DocumentNumber value={vendor.document_number} />}
      />

      <Tabs
        defaultValue="overview"
        className="mt-4 flex min-h-0 flex-1 flex-col gap-0"
      >
        <OperationalWorkspaceSortableTabsBar
          sectionLabel="Vendor workspace"
          tabOrder={tabOrder}
          tabsById={tabsById}
          onReorder={moveTab}
        />

        <TabsContent value="overview" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel className="p-4 md:p-5">
            <VendorOverviewTab vendor={vendor} />
          </OperationalWorkspaceTabPanel>
        </TabsContent>
        <TabsContent value="legal" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel className="p-4 md:p-5">
            <VendorLegalTab vendor={vendor} />
          </OperationalWorkspaceTabPanel>
        </TabsContent>
        <TabsContent value="finance" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel className="p-4 md:p-5">
            <VendorFinanceTab vendor={vendor} />
          </OperationalWorkspaceTabPanel>
        </TabsContent>
        <TabsContent value="documents" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel>
            <VendorDocumentsTab vendor={vendor} />
          </OperationalWorkspaceTabPanel>
        </TabsContent>
        <TabsContent value="platforms" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel className="p-4 md:p-5">
            <VendorPlatformsTab vendor={vendor} />
          </OperationalWorkspaceTabPanel>
        </TabsContent>
        <TabsContent value="campaigns" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel>
            <VendorCampaignsTab vendor={vendor} />
          </OperationalWorkspaceTabPanel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
