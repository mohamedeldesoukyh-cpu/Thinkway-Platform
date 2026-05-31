"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
          <Link href="/groups">
            <ArrowLeftIcon data-icon="inline-start" />
            Back to groups
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            {workspace.name}
          </h2>
          <ClientStatusBadge status={workspace.status} />
        </div>
        <p className="font-mono text-sm text-muted-foreground">
          {workspace.document_number}
          {workspace.region ? ` · ${workspace.region}` : null}
        </p>
      </div>

      <GroupKpiStrip workspace={workspace} />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="legal-entities">Legal entities</TabsTrigger>
          <TabsTrigger value="brands">Brands</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="financial">Financial summary</TabsTrigger>
          <TabsTrigger value="activity">Activity & audit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <GroupOverviewTab
            workspace={workspace}
            accountDirectors={accountDirectors}
          />
        </TabsContent>
        <TabsContent value="legal-entities">
          <GroupLegalEntitiesTab workspace={workspace} />
        </TabsContent>
        <TabsContent value="brands">
          <GroupBrandsTab workspace={workspace} masterData={masterData} />
        </TabsContent>
        <TabsContent value="documents">
          <GroupDocumentsTab workspace={workspace} />
        </TabsContent>
        <TabsContent value="financial">
          <GroupFinancialTab workspace={workspace} />
        </TabsContent>
        <TabsContent value="activity">
          <GroupActivityTab workspace={workspace} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
