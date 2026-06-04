"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { TabErrorBoundary } from "@/components/ui/tab-error-boundary";
import { CampaignDetailsSheet } from "@/features/campaigns/components/campaign-details-sheet";
import { CampaignKpiStrip } from "@/features/campaigns/components/campaign-kpi-strip";
import { CampaignStatusBadge } from "@/features/campaigns/components/campaign-status-badge";
import { DuplicateCampaignDialog } from "@/features/campaigns/components/duplicate-campaign-dialog";
import { CampaignBillingTab } from "@/features/campaigns/components/tabs/campaign-billing-tab";
import { CampaignDeliverablesTab } from "@/features/campaigns/components/tabs/campaign-deliverables-tab";
import { CampaignLinesTab } from "@/features/campaigns/components/tabs/campaign-lines-tab";
import { CampaignPublicationsTab } from "@/features/campaigns/components/tabs/campaign-publications-tab";
import { CampaignOverviewTab } from "@/features/campaigns/components/tabs/campaign-overview-tab";
import { CampaignTimelineTab } from "@/features/campaigns/components/tabs/campaign-timeline-tab";
import { CampaignWorkflowTab } from "@/features/campaigns/components/tabs/campaign-workflow-tab";
import { ClientIoHeaderControls } from "@/features/io/components/client-io-header-controls";
import { VendorIoTab } from "@/features/io/components/vendor-io-tab";
import type { AssignmentBillingGroup, BillingLineRow, CampaignOperationalBillingDetail } from "@/features/billing/types";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignPublicationRow } from "@/features/campaigns/queries/publications";
import { formatPlatformLabel } from "@/features/campaigns/utils";
import { flattenOperationalDeliverables } from "@/lib/campaigns/flatten-operational-deliverables";
import { cn } from "@/lib/utils";

type CampaignWorkspaceViewProps = {
  workspace: import("@/features/campaigns/types").CampaignWorkspace;
  accountManagers: { id: string; full_name: string | null; email: string }[];
  teams: { id: string; name: string }[];
  billingLines: BillingLineRow[];
  billingGroups: AssignmentBillingGroup[];
  operationalBilling: CampaignOperationalBillingDetail | null;
  assignmentHierarchy: AssignmentHierarchy;
  publications: CampaignPublicationRow[];
  publicationsLoadError?: string | null;
  currencyOptions: { value: string; label: string }[];
};

export function CampaignWorkspaceView({
  workspace,
  accountManagers,
  teams,
  billingLines,
  billingGroups,
  operationalBilling,
  assignmentHierarchy,
  publications,
  publicationsLoadError,
  currencyOptions,
}: CampaignWorkspaceViewProps) {
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const operationalDeliverableCount = useMemo(() => {
    return flattenOperationalDeliverables(
      assignmentHierarchy,
      publications,
      workspace.deliverables ?? []
    ).rows.length;
  }, [assignmentHierarchy, publications, workspace.deliverables]);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.debug("[sticky-header] campaign workspace sticky header mounted", {
        campaignId: workspace.id,
      });
    }
  }, [workspace.id]);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.debug("[tab-highlight] active campaign tab", { tab: activeTab });
    }
  }, [activeTab]);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
        <Link href="/campaigns">
          <ArrowLeftIcon data-icon="inline-start" />
          Back to campaigns
        </Link>
      </Button>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <div
          className={cn(
            "sticky top-0 z-30 w-full -mx-4 space-y-6 border-b border-border/60 bg-background px-4 pb-4 pt-1 shadow-sm",
            "md:-mx-8 md:px-8"
          )}
          data-sticky="campaign-workspace-header"
        >
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDetailsOpen(true)}
                  className="font-heading text-left text-2xl font-semibold tracking-tight text-foreground transition-colors hover:text-primary"
                  title="View campaign details"
                >
                  {workspace.name}
                </button>
                <CampaignStatusBadge status={workspace.status} />
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {workspace.client_io ? (
                  <ClientIoHeaderControls
                    io={workspace.client_io}
                    campaignId={workspace.id}
                    viewHref={`/ios/client?io=${workspace.client_io.id}`}
                  />
                ) : null}
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
            </div>
            <p className="font-mono text-sm text-muted-foreground">
              {workspace.document_number}
              {workspace.brand ? ` · ${workspace.brand.name}` : null}
              {workspace.platform
                ? ` · ${formatPlatformLabel(workspace.platform)}`
                : null}
            </p>
          </div>

          <CampaignKpiStrip
            workspace={workspace}
            operationalDeliverableCount={operationalDeliverableCount}
          />

          <div className="-mx-1 border-b border-border px-1">
          <TabsList
            variant="line"
            className="h-auto w-full flex-wrap justify-start gap-0 rounded-none border-0 bg-transparent p-0"
          >
            <TabsTrigger
              value="overview"
              className="rounded-none px-4 py-2.5 after:!h-0.5 after:bg-brand-blue data-active:text-foreground"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="lines"
              className="rounded-none px-4 py-2.5 after:!h-0.5 after:bg-brand-blue data-active:text-foreground"
            >
              Assignments
            </TabsTrigger>
            <TabsTrigger
              value="vendor-io"
              className="rounded-none px-4 py-2.5 after:!h-0.5 after:bg-brand-blue data-active:text-foreground"
            >
              Vendor IO
            </TabsTrigger>
            <TabsTrigger
              value="deliverables"
              className="rounded-none px-4 py-2.5 after:!h-0.5 after:bg-brand-blue data-active:text-foreground"
            >
              Deliverables
            </TabsTrigger>
            <TabsTrigger
              value="publications"
              className="rounded-none px-4 py-2.5 after:!h-0.5 after:bg-brand-blue data-active:text-foreground"
            >
              Publications
            </TabsTrigger>
            <TabsTrigger
              value="workflow"
              className="rounded-none px-4 py-2.5 after:!h-0.5 after:bg-brand-blue data-active:text-foreground"
            >
              Workflow
            </TabsTrigger>
            <TabsTrigger
              value="billing"
              className="rounded-none px-4 py-2.5 after:!h-0.5 after:bg-brand-blue data-active:text-foreground"
            >
              Billing
            </TabsTrigger>
            <TabsTrigger
              value="timeline"
              className="rounded-none px-4 py-2.5 after:!h-0.5 after:bg-brand-blue data-active:text-foreground"
            >
              Timeline & activity
            </TabsTrigger>
          </TabsList>
          </div>
        </div>

        <TabsContent value="overview">
          <CampaignOverviewTab
            workspace={workspace}
            accountManagers={accountManagers}
            teams={teams}
            currencyOptions={currencyOptions}
            onOpenDetails={() => setDetailsOpen(true)}
          />
        </TabsContent>
        <TabsContent value="lines">
          <TabErrorBoundary tabName="Assignments">
            <CampaignLinesTab
              workspace={workspace}
              po={workspace.po}
              currencyOptions={currencyOptions}
              assignmentHierarchy={assignmentHierarchy}
              billingGroups={billingGroups}
            />
          </TabErrorBoundary>
        </TabsContent>
        <TabsContent value="deliverables">
          <TabErrorBoundary tabName="Deliverables">
            <CampaignDeliverablesTab
              workspace={workspace}
              assignmentHierarchy={assignmentHierarchy}
              publications={publications}
            />
          </TabErrorBoundary>
        </TabsContent>
        <TabsContent value="vendor-io">
          <TabErrorBoundary tabName="Vendor IO">
            <VendorIoTab campaignId={workspace.id} rows={workspace.vendor_ios} />
          </TabErrorBoundary>
        </TabsContent>
        <TabsContent value="publications">
          <TabErrorBoundary tabName="Publications">
            <CampaignPublicationsTab
              workspace={workspace}
              publications={publications}
              loadError={publicationsLoadError}
            />
          </TabErrorBoundary>
        </TabsContent>
        <TabsContent value="workflow">
          <TabErrorBoundary tabName="Workflow">
            <CampaignWorkflowTab workspace={workspace} />
          </TabErrorBoundary>
        </TabsContent>
        <TabsContent value="billing">
          <TabErrorBoundary tabName="Billing">
            <CampaignBillingTab
              workspace={workspace}
              billingLines={billingLines}
              billingGroups={billingGroups}
              operationalBilling={operationalBilling}
            />
          </TabErrorBoundary>
        </TabsContent>
        <TabsContent value="timeline">
          <TabErrorBoundary tabName="Timeline">
            <CampaignTimelineTab workspace={workspace} />
          </TabErrorBoundary>
        </TabsContent>
      </Tabs>

      <CampaignDetailsSheet
        workspace={workspace}
        accountManagers={accountManagers}
        teams={teams}
        currencyOptions={currencyOptions}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />

      <DuplicateCampaignDialog
        workspace={workspace}
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
      />
    </div>
  );
}
