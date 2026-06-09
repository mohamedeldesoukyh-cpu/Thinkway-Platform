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
  GROUP_WORKSPACE_TAB_ORDER,
  GROUP_WORKSPACE_TAB_STORAGE_KEY,
  isGroupWorkspaceTabId,
  type GroupWorkspaceTabId,
} from "@/lib/workspace/platform-workspace-tabs";
import { ClientStatusBadge } from "@/features/clients/components/client-status-badge";
import { GroupKpiStrip } from "@/features/groups/components/group-kpi-strip";
import { GroupActivityTab } from "@/features/groups/components/tabs/group-activity-tab";
import { GroupBrandsTab } from "@/features/groups/components/tabs/group-brands-tab";
import { GroupDocumentsTab } from "@/features/groups/components/tabs/group-documents-tab";
import { GroupFinancialTab } from "@/features/groups/components/tabs/group-financial-tab";
import { GroupLegalEntitiesTab } from "@/features/groups/components/tabs/group-legal-entities-tab";
import { GroupOverviewTab } from "@/features/groups/components/tabs/group-overview-tab";
import type { GroupWorkspace } from "@/features/groups/types";
import type { MasterDataOptions } from "@/lib/master-data/queries";

type GroupWorkspaceViewProps = {
  workspace: GroupWorkspace;
  accountDirectors: { id: string; full_name: string | null; email: string }[];
  masterData: MasterDataOptions;
};

export function GroupWorkspaceView({
  workspace,
  accountDirectors,
  masterData,
}: GroupWorkspaceViewProps) {
  const { tabOrder, moveTab } = useWorkspaceTabOrder({
    storageKey: GROUP_WORKSPACE_TAB_STORAGE_KEY,
    defaultOrder: GROUP_WORKSPACE_TAB_ORDER,
    isValidId: isGroupWorkspaceTabId,
  });

  const tabsById = useMemo(
    (): Record<GroupWorkspaceTabId, OperationalWorkspaceTabDef> => ({
      overview: { value: "overview", label: "Overview" },
      "legal-entities": {
        value: "legal-entities",
        label: "Legal entities",
        count: workspace.counts.legal_entities,
      },
      brands: { value: "brands", label: "Brands", count: workspace.counts.brands },
      documents: { value: "documents", label: "Documents" },
      financial: { value: "financial", label: "Financial summary" },
      activity: { value: "activity", label: "Activity & audit" },
    }),
    [workspace.counts.legal_entities, workspace.counts.brands]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0">
      <div className="space-y-4">
        <OperationalWorkspaceChrome
          backButton={
            <PageBackButton fallbackHref="/groups" label="Back to groups" />
          }
          title={workspace.name}
          badges={<ClientStatusBadge status={workspace.status} />}
          meta={
            <>
              <DocumentNumber value={workspace.document_number} />
              {workspace.region ? ` · ${workspace.region}` : null}
            </>
          }
        />
        <GroupKpiStrip workspace={workspace} />
      </div>

      <Tabs
        defaultValue="overview"
        className="mt-4 flex min-h-0 flex-1 flex-col gap-0"
      >
        <OperationalWorkspaceSortableTabsBar
          sectionLabel="Group workspace"
          tabOrder={tabOrder}
          tabsById={tabsById}
          onReorder={moveTab}
        />

        <TabsContent value="overview" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel className="p-4 md:p-5">
            <GroupOverviewTab workspace={workspace} accountDirectors={accountDirectors} />
          </OperationalWorkspaceTabPanel>
        </TabsContent>
        <TabsContent value="legal-entities" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel>
            <GroupLegalEntitiesTab workspace={workspace} masterData={masterData} />
          </OperationalWorkspaceTabPanel>
        </TabsContent>
        <TabsContent value="brands" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel>
            <GroupBrandsTab workspace={workspace} masterData={masterData} />
          </OperationalWorkspaceTabPanel>
        </TabsContent>
        <TabsContent value="documents" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel>
            <GroupDocumentsTab workspace={workspace} />
          </OperationalWorkspaceTabPanel>
        </TabsContent>
        <TabsContent value="financial" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel className="p-4 md:p-5">
            <GroupFinancialTab workspace={workspace} />
          </OperationalWorkspaceTabPanel>
        </TabsContent>
        <TabsContent value="activity" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel>
            <GroupActivityTab workspace={workspace} />
          </OperationalWorkspaceTabPanel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
