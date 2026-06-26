"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageBackButton } from "@/components/navigation/page-back-button";
import {
  CreatorIdentityCell,
  creatorProfileSourceFromAccounts,
} from "@/components/creator/creator-profile-link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs } from "@/components/ui/tabs";
import {
  OperationalWorkspaceTabContent,
  OperationalWorkspaceTabPanel,
} from "@/components/workspace/operational-workspace-ui";
import {
  OPERATIONAL_CHROME_LABEL,
  OPERATIONAL_CHROME_META,
  OPERATIONAL_CHROME_STATUS_BADGE,
} from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { VendorDependencyDialog } from "@/features/vendors/components/vendor-dependency-dialog";
import { VendorKpiStrip } from "@/features/vendors/components/vendor-kpi-strip";
import { VendorStatusBadge } from "@/features/vendors/components/vendor-status-badge";
import { VendorActivityTab } from "@/features/vendors/components/tabs/vendor-activity-tab";
import { VendorAssignmentsTab } from "@/features/vendors/components/tabs/vendor-assignments-tab";
import { VendorBillingTab } from "@/features/vendors/components/tabs/vendor-billing-tab";
import { VendorContractsTab } from "@/features/vendors/components/tabs/vendor-contracts-tab";
import { VendorDocumentsTab } from "@/features/vendors/components/tabs/vendor-documents-tab";
import { VendorOverviewTab } from "@/features/vendors/components/tabs/vendor-overview-tab";
import { VendorPlatformsTab } from "@/features/vendors/components/tabs/vendor-platforms-tab";
import { DocumentNumber } from "@/components/ui/document-number";
import type { VendorWorkspace } from "@/features/vendors/types";
import { cn } from "@/lib/utils";

type VendorWorkspaceViewProps = {
  workspace: VendorWorkspace;
  defaultTab?: string;
  portalAccessPanel?: React.ReactNode;
  currencyOptions?: { value: string; label: string }[];
};

const VENDOR_WORKSPACE_TAB_IDS = [
  "overview",
  "platforms",
  "assignments",
  "billing",
  "documents",
  "contracts",
  "activity",
] as const;

type VendorWorkspaceTabId = (typeof VENDOR_WORKSPACE_TAB_IDS)[number];

function isVendorWorkspaceTabId(value: string): value is VendorWorkspaceTabId {
  return (VENDOR_WORKSPACE_TAB_IDS as readonly string[]).includes(value);
}

const tabPanelClassName =
  "mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none focus-visible:outline-none";

export function VendorWorkspaceView({
  workspace,
  defaultTab = "overview",
  portalAccessPanel,
  currencyOptions = [],
}: VendorWorkspaceViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [depOpen, setDepOpen] = useState(false);
  const initialTab = isVendorWorkspaceTabId(defaultTab) ? defaultTab : "overview";
  const [activeTab, setActiveTab] = useState<VendorWorkspaceTabId>(initialTab);

  useEffect(() => {
    setActiveTab(isVendorWorkspaceTabId(defaultTab) ? defaultTab : "overview");
  }, [defaultTab]);

  const handleCancel = useCallback(() => {
    router.push("/vendors");
  }, [router]);

  const handleTabChange = useCallback(
    (value: string) => {
      if (!isVendorWorkspaceTabId(value)) {
        return;
      }
      setActiveTab(value);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", value);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const tabCounts = useMemo(
    () => ({
      platforms: workspace.counts.platforms,
      assignments: workspace.counts.assignments,
      documents: workspace.documents.length,
      activity: workspace.activity.length,
    }),
    [
      workspace.counts.platforms,
      workspace.counts.assignments,
      workspace.documents.length,
      workspace.activity.length,
    ]
  );

  const tabs = useMemo(
    () =>
      [
        { id: "overview" as const, label: "Overview" },
        { id: "platforms" as const, label: "Platforms", count: tabCounts.platforms },
        {
          id: "assignments" as const,
          label: "Assignments",
          count: tabCounts.assignments,
        },
        { id: "billing" as const, label: "Billing & Payments" },
        { id: "documents" as const, label: "Documents", count: tabCounts.documents },
        { id: "contracts" as const, label: "Contracts" },
        {
          id: "activity" as const,
          label: "Activity & Audit",
          count: tabCounts.activity,
        },
      ] satisfies Array<{
        id: VendorWorkspaceTabId;
        label: string;
        count?: number;
      }>,
    [tabCounts]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
      <div className="shrink-0 space-y-4 px-[26px] pb-2 pt-0">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <PageBackButton fallbackHref="/vendors" label="Back to vendors" />
              <CreatorIdentityCell
                source={creatorProfileSourceFromAccounts(
                  workspace.display_name,
                  workspace.platform_accounts
                )}
                size="md"
                showHandle={false}
                stopPropagation
              />
              <VendorStatusBadge
                status={workspace.status}
                className={OPERATIONAL_CHROME_STATUS_BADGE}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(OPERATIONAL_CHROME_LABEL, "h-7 gap-1 px-2")}
                >
                  <MoreHorizontalIcon className="size-3.5" />
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setDepOpen(true)}>
                  View dependencies
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/operations/move?vendor=${workspace.id}`}>
                    Reassign via Move
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className={cn(OPERATIONAL_CHROME_META, "pl-10")}>
            <DocumentNumber value={workspace.document_number} />
            {workspace.country_code ? ` · ${workspace.country_code}` : null}
          </p>
        </div>

        <VendorKpiStrip workspace={workspace} />
      </div>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="mt-0 flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
      >
        <nav
          aria-label="Creator workspace sections"
          className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-[26px] py-2.5"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Also view
          </span>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "text-[13px] font-medium transition-colors",
                  isActive
                    ? "font-semibold text-[#0057FF]"
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
              vendor={workspace}
              portalAccessPanel={portalAccessPanel}
              onCancel={handleCancel}
              shortcutsEnabled={activeTab === "overview"}
            />
          </OperationalWorkspaceTabPanel>
        </OperationalWorkspaceTabContent>
        <OperationalWorkspaceTabContent value="platforms" className={tabPanelClassName}>
          <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <VendorPlatformsTab vendor={workspace} onCancel={handleCancel} />
          </OperationalWorkspaceTabPanel>
        </OperationalWorkspaceTabContent>
        <OperationalWorkspaceTabContent value="assignments" className={tabPanelClassName}>
          <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <VendorAssignmentsTab workspace={workspace} onCancel={handleCancel} />
          </OperationalWorkspaceTabPanel>
        </OperationalWorkspaceTabContent>
        <OperationalWorkspaceTabContent value="billing" className={tabPanelClassName}>
          <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {activeTab === "billing" ? (
              <VendorBillingTab
                workspace={workspace}
                currencyOptions={currencyOptions}
                onCancel={handleCancel}
              />
            ) : null}
          </OperationalWorkspaceTabPanel>
        </OperationalWorkspaceTabContent>
        <OperationalWorkspaceTabContent value="documents" className={tabPanelClassName}>
          <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <VendorDocumentsTab vendor={workspace} onCancel={handleCancel} />
          </OperationalWorkspaceTabPanel>
        </OperationalWorkspaceTabContent>
        <OperationalWorkspaceTabContent value="contracts" className={tabPanelClassName}>
          <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <VendorContractsTab
              vendor={workspace}
              onCancel={handleCancel}
              shortcutsEnabled={activeTab === "contracts"}
            />
          </OperationalWorkspaceTabPanel>
        </OperationalWorkspaceTabContent>
        <OperationalWorkspaceTabContent value="activity" className={tabPanelClassName}>
          <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <VendorActivityTab workspace={workspace} onCancel={handleCancel} />
          </OperationalWorkspaceTabPanel>
        </OperationalWorkspaceTabContent>
      </Tabs>

      <VendorDependencyDialog
        vendorId={workspace.id}
        vendorName={workspace.display_name}
        open={depOpen}
        onOpenChange={setDepOpen}
        onArchive={
          workspace.counts.assignments === 0 ? () => setDepOpen(false) : undefined
        }
      />
    </div>
  );
}
