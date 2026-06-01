"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignKpiStrip } from "@/features/campaigns/components/campaign-kpi-strip";
import { CampaignStatusBadge } from "@/features/campaigns/components/campaign-status-badge";
import { CampaignBillingTab } from "@/features/campaigns/components/tabs/campaign-billing-tab";
import { CampaignDeliverablesTab } from "@/features/campaigns/components/tabs/campaign-deliverables-tab";
import { CampaignLinesTab } from "@/features/campaigns/components/tabs/campaign-lines-tab";
import { CampaignOverviewTab } from "@/features/campaigns/components/tabs/campaign-overview-tab";
import { CampaignTimelineTab } from "@/features/campaigns/components/tabs/campaign-timeline-tab";
import { CampaignVendorsTab } from "@/features/campaigns/components/tabs/campaign-vendors-tab";
import { CampaignWorkflowTab } from "@/features/campaigns/components/tabs/campaign-workflow-tab";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { formatPlatformLabel } from "@/features/campaigns/utils";

type CampaignWorkspaceViewProps = {
  workspace: CampaignWorkspace;
  accountManagers: { id: string; full_name: string | null; email: string }[];
  teams: { id: string; name: string }[];
};

export function CampaignWorkspaceView({
  workspace,
  accountManagers,
  teams,
}: CampaignWorkspaceViewProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
          <Link href="/campaigns">
            <ArrowLeftIcon data-icon="inline-start" />
            Back to campaigns
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            {workspace.name}
          </h2>
          <CampaignStatusBadge status={workspace.status} />
        </div>
        <p className="font-mono text-sm text-muted-foreground">
          {workspace.document_number}
          {workspace.brand ? ` · ${workspace.brand.name}` : null}
          {workspace.platform
            ? ` · ${formatPlatformLabel(workspace.platform)}`
            : null}
        </p>
      </div>

      <CampaignKpiStrip workspace={workspace} />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="lines">Campaign lines</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="timeline">Timeline & activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <CampaignOverviewTab
            workspace={workspace}
            accountManagers={accountManagers}
            teams={teams}
          />
        </TabsContent>
        <TabsContent value="lines">
          <CampaignLinesTab workspace={workspace} />
        </TabsContent>
        <TabsContent value="vendors">
          <CampaignVendorsTab workspace={workspace} />
        </TabsContent>
        <TabsContent value="deliverables">
          <CampaignDeliverablesTab workspace={workspace} />
        </TabsContent>
        <TabsContent value="workflow">
          <CampaignWorkflowTab workspace={workspace} />
        </TabsContent>
        <TabsContent value="billing">
          <CampaignBillingTab workspace={workspace} />
        </TabsContent>
        <TabsContent value="timeline">
          <CampaignTimelineTab workspace={workspace} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
