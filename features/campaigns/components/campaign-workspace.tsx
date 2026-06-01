"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeftIcon,
  CopyIcon,
  MoreHorizontalIcon,
  PencilIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignKpiStrip } from "@/features/campaigns/components/campaign-kpi-strip";
import { CampaignStatusBadge } from "@/features/campaigns/components/campaign-status-badge";
import { DuplicateCampaignDialog } from "@/features/campaigns/components/duplicate-campaign-dialog";
import { CampaignBillingTab } from "@/features/campaigns/components/tabs/campaign-billing-tab";
import { CampaignDeliverablesTab } from "@/features/campaigns/components/tabs/campaign-deliverables-tab";
import { CampaignLinesTab } from "@/features/campaigns/components/tabs/campaign-lines-tab";
import { CampaignOverviewTab } from "@/features/campaigns/components/tabs/campaign-overview-tab";
import { CampaignTimelineTab } from "@/features/campaigns/components/tabs/campaign-timeline-tab";
import { CampaignWorkflowTab } from "@/features/campaigns/components/tabs/campaign-workflow-tab";
import type { AssignmentBillingGroup, BillingLineRow } from "@/features/billing/types";
import { formatPlatformLabel } from "@/features/campaigns/utils";

type CampaignWorkspaceViewProps = {
  workspace: import("@/features/campaigns/types").CampaignWorkspace;
  accountManagers: { id: string; full_name: string | null; email: string }[];
  teams: { id: string; name: string }[];
  billingLines: BillingLineRow[];
  billingGroups: AssignmentBillingGroup[];
  currencyOptions: { value: string; label: string }[];
};

export function CampaignWorkspaceView({
  workspace,
  accountManagers,
  teams,
  billingLines,
  billingGroups,
  currencyOptions,
}: CampaignWorkspaceViewProps) {
  const [duplicateOpen, setDuplicateOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
          <Link href="/campaigns">
            <ArrowLeftIcon data-icon="inline-start" />
            Back to campaigns
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              {workspace.name}
            </h2>
            <CampaignStatusBadge status={workspace.status} />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontalIcon className="size-4" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDuplicateOpen(true)}>
                <CopyIcon className="size-4" />
                Duplicate campaign
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <PencilIcon className="size-4" />
                Edit header (Overview tab)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
          <TabsTrigger value="lines">Assignments</TabsTrigger>
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
            currencyOptions={currencyOptions}
          />
        </TabsContent>
        <TabsContent value="lines">
          <CampaignLinesTab
            workspace={workspace}
            po={workspace.po}
            currencyOptions={currencyOptions}
          />
        </TabsContent>
        <TabsContent value="deliverables">
          <CampaignDeliverablesTab workspace={workspace} />
        </TabsContent>
        <TabsContent value="workflow">
          <CampaignWorkflowTab workspace={workspace} />
        </TabsContent>
        <TabsContent value="billing">
          <CampaignBillingTab
            workspace={workspace}
            billingLines={billingLines}
            billingGroups={billingGroups}
          />
        </TabsContent>
        <TabsContent value="timeline">
          <CampaignTimelineTab workspace={workspace} />
        </TabsContent>
      </Tabs>

      <DuplicateCampaignDialog
        workspace={workspace}
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
      />
    </div>
  );
}
