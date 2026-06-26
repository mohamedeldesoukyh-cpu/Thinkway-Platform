"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Tabs } from "@/components/ui/tabs";
import {
  OperationalWorkspaceTabContent,
  OperationalWorkspaceTabPanel,
  type OperationalWorkspaceTabDef,
} from "@/components/workspace/operational-workspace-ui";
import { useWorkspaceTabOrder } from "@/hooks/use-workspace-tab-order";
import {
  VENDOR_PROFILE_TAB_ORDER,
  VENDOR_PROFILE_TAB_STORAGE_KEY,
  isVendorProfileTabId,
  type VendorProfileTabId,
} from "@/lib/workspace/platform-workspace-tabs";
import type { VendorDetail } from "@/types/database";
import { cn } from "@/lib/utils";

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
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<VendorProfileTabId>("overview");
  const { tabOrder } = useWorkspaceTabOrder({
    storageKey: VENDOR_PROFILE_TAB_STORAGE_KEY,
    defaultOrder: VENDOR_PROFILE_TAB_ORDER,
    isValidId: isVendorProfileTabId,
  });

  const handleCancel = () => router.push("/vendors");

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

  const tabPanelClassName =
    "mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none focus-visible:outline-none";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (isVendorProfileTabId(value)) {
            setActiveTab(value);
          }
        }}
        className="mt-0 flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
      >
        <nav
          aria-label="Creator workspace sections"
          className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-[26px] py-2.5"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Also view
          </span>
          {tabOrder.map((tabId) => {
            const tab = tabsById[tabId];
            const isActive = activeTab === tabId;
            return (
              <button
                key={tabId}
                type="button"
                onClick={() => setActiveTab(tabId)}
                className={cn(
                  "text-[13px] font-medium transition-colors",
                  isActive
                    ? "font-semibold text-primary"
                    : "text-muted-foreground hover:text-primary"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.label}
                {tab.count != null ? ` (${tab.count})` : ""}
              </button>
            );
          })}
        </nav>

        <OperationalWorkspaceTabContent value="overview" className={tabPanelClassName}>
          <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <VendorOverviewTab
              vendor={vendor}
              onCancel={handleCancel}
              shortcutsEnabled={activeTab === "overview"}
            />
          </OperationalWorkspaceTabPanel>
        </OperationalWorkspaceTabContent>
        <OperationalWorkspaceTabContent value="legal" className={tabPanelClassName}>
          <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <VendorLegalTab
              vendor={vendor}
              onCancel={handleCancel}
              shortcutsEnabled={activeTab === "legal"}
            />
          </OperationalWorkspaceTabPanel>
        </OperationalWorkspaceTabContent>
        <OperationalWorkspaceTabContent value="finance" className={tabPanelClassName}>
          <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <VendorFinanceTab vendor={vendor} onCancel={handleCancel} />
          </OperationalWorkspaceTabPanel>
        </OperationalWorkspaceTabContent>
        <OperationalWorkspaceTabContent value="documents" className={tabPanelClassName}>
          <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <VendorDocumentsTab vendor={vendor} onCancel={handleCancel} />
          </OperationalWorkspaceTabPanel>
        </OperationalWorkspaceTabContent>
        <OperationalWorkspaceTabContent value="platforms" className={tabPanelClassName}>
          <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <VendorPlatformsTab vendor={vendor} onCancel={handleCancel} />
          </OperationalWorkspaceTabPanel>
        </OperationalWorkspaceTabContent>
        <OperationalWorkspaceTabContent value="campaigns" className={tabPanelClassName}>
          <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <VendorCampaignsTab vendor={vendor} onCancel={handleCancel} />
          </OperationalWorkspaceTabPanel>
        </OperationalWorkspaceTabContent>
      </Tabs>
    </div>
  );
}
