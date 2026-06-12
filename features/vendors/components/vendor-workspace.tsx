"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageBackButton } from "@/components/navigation/page-back-button";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { CampaignWorkspaceScrollShell } from "@/features/campaigns/components/campaign-workspace-scroll-shell";
import {
  OPERATIONAL_CHROME_LABEL,
  OPERATIONAL_CHROME_META,
  OPERATIONAL_CHROME_STATUS_BADGE,
  OPERATIONAL_CHROME_TITLE,
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
import {
  VendorWorkspaceTabPanel,
  VendorWorkspaceTabTrigger,
  VendorWorkspaceTabsBar,
} from "@/features/vendors/components/vendor-workspace-tabs";
import { DocumentNumber } from "@/components/ui/document-number";
import type { VendorWorkspace } from "@/features/vendors/types";
import { cn } from "@/lib/utils";

type VendorWorkspaceViewProps = {
  workspace: VendorWorkspace;
  defaultTab?: string;
  portalAccessPanel?: React.ReactNode;
  currencyOptions?: { value: string; label: string }[];
};

const TAB_PANEL_CLASS =
  "mt-4 flex-none outline-none focus-visible:outline-none data-[state=inactive]:hidden";

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
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const handleTabChange = useCallback(
    (value: string) => {
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

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
      >
        <CampaignWorkspaceScrollShell
          chrome={
            <>
              <div className="space-y-1 pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <PageBackButton
                      fallbackHref="/vendors"
                      label="Back to vendors"
                    />
                    <h1 className={OPERATIONAL_CHROME_TITLE}>{workspace.display_name}</h1>
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
            </>
          }
          tabs={
            <VendorWorkspaceTabsBar>
              <VendorWorkspaceTabTrigger value="overview" label="Overview" />
              <VendorWorkspaceTabTrigger
                value="platforms"
                label="Platforms"
                count={tabCounts.platforms}
              />
              <VendorWorkspaceTabTrigger
                value="assignments"
                label="Assignments"
                count={tabCounts.assignments}
              />
              <VendorWorkspaceTabTrigger value="billing" label="Billing & Payments" />
              <VendorWorkspaceTabTrigger
                value="documents"
                label="Documents"
                count={tabCounts.documents}
              />
              <VendorWorkspaceTabTrigger value="contracts" label="Contracts" />
              <VendorWorkspaceTabTrigger
                value="activity"
                label="Activity & Audit"
                count={tabCounts.activity}
              />
            </VendorWorkspaceTabsBar>
          }
        >
          <TabsContent value="overview" className={TAB_PANEL_CLASS}>
            <VendorWorkspaceTabPanel className="p-4 md:p-5">
              <VendorOverviewTab vendor={workspace} portalAccessPanel={portalAccessPanel} />
            </VendorWorkspaceTabPanel>
          </TabsContent>
          <TabsContent value="platforms" className={TAB_PANEL_CLASS}>
            <VendorWorkspaceTabPanel>
              <VendorPlatformsTab vendor={workspace} />
            </VendorWorkspaceTabPanel>
          </TabsContent>
          <TabsContent value="assignments" className={TAB_PANEL_CLASS}>
            <VendorWorkspaceTabPanel>
              <VendorAssignmentsTab workspace={workspace} />
            </VendorWorkspaceTabPanel>
          </TabsContent>
          <TabsContent value="billing" className={TAB_PANEL_CLASS}>
            <VendorWorkspaceTabPanel className="min-h-0">
              {activeTab === "billing" ? (
                <VendorBillingTab
                  workspace={workspace}
                  currencyOptions={currencyOptions}
                />
              ) : null}
            </VendorWorkspaceTabPanel>
          </TabsContent>
          <TabsContent value="documents" className={TAB_PANEL_CLASS}>
            <VendorWorkspaceTabPanel className="p-4 md:p-5">
              <VendorDocumentsTab vendor={workspace} />
            </VendorWorkspaceTabPanel>
          </TabsContent>
          <TabsContent value="contracts" className={TAB_PANEL_CLASS}>
            <VendorWorkspaceTabPanel className="p-4 md:p-5">
              <VendorContractsTab vendor={workspace} />
            </VendorWorkspaceTabPanel>
          </TabsContent>
          <TabsContent value="activity" className={TAB_PANEL_CLASS}>
            <VendorWorkspaceTabPanel>
              <VendorActivityTab workspace={workspace} />
            </VendorWorkspaceTabPanel>
          </TabsContent>
        </CampaignWorkspaceScrollShell>
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
