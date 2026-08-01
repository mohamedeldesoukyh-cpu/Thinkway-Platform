"use client";

import Link from "next/link";
import { BadgeCheckIcon, MoreHorizontalIcon, PencilIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignEditSheet } from "@/features/campaigns/components/campaign-edit-sheet";
import { CampaignStatusBadge } from "@/features/campaigns/components/campaign-status-badge";
import {
  ClientApprovalPill,
  DetailField,
  DetailPill,
  DetailPanelHeader,
  DetailTabList,
  DETAIL_TAB_TRIGGER_CLASS,
  OperationalDetailSheet,
  TeamMemberValue,
} from "@/features/campaigns/components/operational-detail-panel";
import { DocumentNumber } from "@/components/ui/document-number";
import {
  formatAssignmentDetailDate,
  initialsFromName,
} from "@/lib/campaigns/assignment-detail-presenters";
import {
  resolveCampaignDisplayDates,
  resolveCampaignDisplayGroup,
  resolveCampaignDisplayPlatform,
} from "@/lib/campaigns/campaign-workspace-presenters";
import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { formatMoney } from "@/features/campaigns/utils";
import { PO_STATUS_LABELS } from "@/lib/finance/po/status";
import { cn } from "@/lib/utils";

type CampaignDetailTabCounts = {
  lines: number;
  deliverables: number;
  vendorIo: number;
  publications: number;
  workflow: number;
  billing: number;
};

type CampaignDetailsSheetProps = {
  workspace: CampaignWorkspace;
  accountManagers: { id: string; full_name: string | null; email: string }[];
  teams: { id: string; name: string }[];
  groups: { id: string; name: string; document_number: string }[];
  currencyOptions: { value: string; label: string }[];
  tabCounts?: CampaignDetailTabCounts;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateToTab?: (tabId: CampaignWorkspaceTabId) => void;
};

function CampaignParticipationTab({ workspace }: { workspace: CampaignWorkspace }) {
  const currency = workspace.currency_code;
  const financials = workspace.financials;
  const displayGroup = resolveCampaignDisplayGroup(workspace);
  const displayPlatform = resolveCampaignDisplayPlatform(workspace);
  const displayDates = resolveCampaignDisplayDates(workspace);

  return (
    <div className="px-1">
      <DetailField label="Brand">
        {workspace.brand ? (
          <DetailPill>{workspace.brand.name}</DetailPill>
        ) : (
          "—"
        )}
      </DetailField>
      <DetailField label="Legal entity">
        {workspace.client ? (
          <Link href={`/clients/${workspace.client.id}`} className="hover:text-primary hover:underline">
            {workspace.client.name}
          </Link>
        ) : (
          "—"
        )}
      </DetailField>
      <DetailField label="Group">
        {displayGroup ? (
          <Link href={`/groups/${displayGroup.id}`} className="hover:text-primary hover:underline">
            {displayGroup.name}
          </Link>
        ) : (
          "—"
        )}
      </DetailField>
      <DetailField label="Platform">
        <DetailPill>{displayPlatform}</DetailPill>
      </DetailField>
      <DetailField label="Campaign status">
        <CampaignStatusBadge status={workspace.status} />
      </DetailField>
      <DetailField label="Workflow stage">
        <DetailPill className="capitalize">{workspace.workflow_stage.replace(/_/g, " ")}</DetailPill>
      </DetailField>
      <DetailField label="Client approval">
        <ClientApprovalPill status={workspace.client_io?.status ?? null} />
      </DetailField>
      <DetailField label="Team member">
        <TeamMemberValue
          name={workspace.account_manager?.full_name}
          email={workspace.account_manager?.email}
        />
      </DetailField>
      <DetailField label="Team">{workspace.team?.name ?? "—"}</DetailField>
      <DetailField label="Start date">
        {formatAssignmentDetailDate(displayDates.start)}
      </DetailField>
      <DetailField label="End date">
        {formatAssignmentDetailDate(displayDates.end)}
      </DetailField>
      <DetailField label="PO budget">
        <span className={cn(financials.po_exceeded && "font-medium text-red-600 dark:text-red-400")}>
          {formatMoney(financials.budget, currency)}
        </span>
      </DetailField>
      <DetailField label="Currency">{currency}</DetailField>
    </div>
  );
}

function CampaignGeneralTab({
  workspace,
  tabCounts,
  onNavigateToTab,
}: {
  workspace: CampaignWorkspace;
  tabCounts?: CampaignDetailTabCounts;
  onNavigateToTab?: (tabId: CampaignWorkspaceTabId) => void;
}) {
  const currency = workspace.currency_code;
  const pendingApprovals = workspace.approvals.filter((row) => row.status === "pending").length;
  const navigate = (tabId: CampaignWorkspaceTabId) =>
    onNavigateToTab ? () => onNavigateToTab(tabId) : undefined;

  return (
    <div className="px-1">
      <DetailField label="Campaign #" onLabelClick={navigate("overview")}>
        <DocumentNumber value={workspace.document_number} />
      </DetailField>
      <DetailField label="Assignments" onLabelClick={navigate("lines")}>
        {tabCounts?.lines ?? workspace.lines.length}
      </DetailField>
      <DetailField label="Deliverables" onLabelClick={navigate("deliverables")}>
        {tabCounts?.deliverables ?? workspace.deliverables.length}
      </DetailField>
      <DetailField label="Vendor IOs" onLabelClick={navigate("vendor-io")}>
        {tabCounts?.vendorIo ?? workspace.vendor_ios.length}
      </DetailField>
      <DetailField label="Invoices" onLabelClick={navigate("billing")}>
        {workspace.invoices.length}
      </DetailField>
      <DetailField label="Payments" onLabelClick={navigate("billing")}>
        {workspace.payments.length}
      </DetailField>
      <DetailField label="Pending approvals" onLabelClick={navigate("workflow")}>
        {pendingApprovals}
      </DetailField>
      <DetailField label="PO status" onLabelClick={navigate("overview")}>
        <DetailPill>{PO_STATUS_LABELS[workspace.po.po_status]}</DetailPill>
      </DetailField>
      <DetailField label="PO consumed" onLabelClick={navigate("overview")}>
        {formatMoney(workspace.financials.po_consumed, currency)}
      </DetailField>
      <DetailField label="PO remaining" onLabelClick={navigate("overview")}>
        {formatMoney(workspace.financials.remaining_po, currency)}
      </DetailField>
      <DetailField label="Billing outstanding" onLabelClick={navigate("billing")}>
        {formatMoney(workspace.financials.billing_outstanding, currency)}
      </DetailField>
    </div>
  );
}

function CampaignHierarchyTab({ workspace }: { workspace: CampaignWorkspace }) {
  const displayGroup = resolveCampaignDisplayGroup(workspace);

  return (
    <div className="px-1">
      <DetailField label="Group">
        {displayGroup ? (
          <Link href={`/groups/${displayGroup.id}`} className="hover:text-primary hover:underline">
            {displayGroup.name}
          </Link>
        ) : (
          "—"
        )}
      </DetailField>
      <DetailField label="Legal entity">
        {workspace.client ? (
          <Link href={`/clients/${workspace.client.id}`} className="hover:text-primary hover:underline">
            {workspace.client.name}
          </Link>
        ) : (
          "—"
        )}
      </DetailField>
      <DetailField label="Brand">
        {workspace.brand?.name ?? "—"}
      </DetailField>
      <DetailField label="Brand #">
        {workspace.brand ? <DocumentNumber value={workspace.brand.document_number} /> : "—"}
      </DetailField>
      <DetailField label="Client IO">
        {workspace.client_io ? (
          <Link
            href={`/ios/client?io=${workspace.client_io.id}`}
            className="hover:text-primary hover:underline"
          >
            View client IO
          </Link>
        ) : (
          <span className="text-muted-foreground">
            Not set up — use <strong className="font-medium text-foreground">Set up Client IO</strong>{" "}
            in the campaign header.
          </span>
        )}
      </DetailField>
      {workspace.description ? (
        <DetailField label="Description">
          <span className="line-clamp-4 text-left text-muted-foreground">{workspace.description}</span>
        </DetailField>
      ) : null}
    </div>
  );
}

function CampaignActivityTab({ workspace }: { workspace: CampaignWorkspace }) {
  const activity = workspace.activity ?? [];

  if (activity.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">No recent activity on this campaign yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activity.slice(0, 20).map((item) => (
        <div
          key={item.id}
          className="rounded-xl border border-border/50 bg-muted/15 px-4 py-3 text-xs"
        >
          <p className="font-medium text-foreground">{item.summary}</p>
          <p className="mt-1 text-muted-foreground">
            {item.actor?.full_name ?? item.actor?.email ?? "System"} ·{" "}
            {formatAssignmentDetailDate(item.created_at.slice(0, 10))}
          </p>
        </div>
      ))}
    </div>
  );
}

function CampaignPerformanceTab({
  onNavigateToTab,
}: {
  workspace: CampaignWorkspace;
  onNavigateToTab?: (tab: CampaignWorkspaceTabId) => void;
}) {
  return (
    <div className="space-y-4 px-1">
      <p className="text-sm text-muted-foreground">
        Campaign financial KPIs live in the workspace header and Finance workspace. Use those
        surfaces for Revenue, Cost, GP, and Margin.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onNavigateToTab?.("billing")}
        >
          Open Finance workspace
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onNavigateToTab?.("publications")}
        >
          Open Performance workspace
        </Button>
      </div>
    </div>
  );
}

export function CampaignDetailsSheet({
  workspace,
  accountManagers,
  teams,
  groups,
  currencyOptions,
  tabCounts,
  open,
  onOpenChange,
  onNavigateToTab,
}: CampaignDetailsSheetProps) {
  const [editOpen, setEditOpen] = useState(false);

  const breadcrumb = (
    <>
      {workspace.brand?.name ?? workspace.group?.name ?? "Campaign"}
      <span className="text-muted-foreground/60"> / </span>
      <span className="text-foreground/80">{workspace.name}</span>
    </>
  );

  return (
    <>
      <OperationalDetailSheet
        open={open}
        onOpenChange={onOpenChange}
        title={`${workspace.name} campaign details`}
        description={`Campaign workspace details for ${workspace.document_number}`}
      >
        <DetailPanelHeader
          breadcrumb={breadcrumb}
          avatarInitials={initialsFromName(workspace.brand?.name ?? workspace.name)}
          title={workspace.name}
          subtitle={<BadgeCheckIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
          badges={
            <>
              <CampaignStatusBadge status={workspace.status} />
              <DetailPill>{resolveCampaignDisplayPlatform(workspace)}</DetailPill>
              <DocumentNumber
                value={workspace.document_number}
                className="text-[11px] text-muted-foreground"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-7 text-muted-foreground"
                onClick={() => setEditOpen(true)}
                title="Edit campaign"
              >
                <PencilIcon className="size-3.5" />
              </Button>
            </>
          }
          actions={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="shrink-0">
                  <MoreHorizontalIcon className="size-4" />
                  <span className="sr-only">Campaign actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <PencilIcon className="size-4" />
                  Edit campaign
                </DropdownMenuItem>
                {workspace.client ? (
                  <DropdownMenuItem asChild>
                    <Link href={`/clients/${workspace.client.id}`}>View legal entity</Link>
                  </DropdownMenuItem>
                ) : null}
                {workspace.brand ? (
                  <DropdownMenuItem asChild>
                    <Link href={`/campaigns/${workspace.id}`}>Open workspace</Link>
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />

        <Tabs defaultValue="participation" className="flex min-h-0 flex-1 flex-col">
          <DetailTabList>
            <TabsList
              variant="line"
              className="h-auto w-full justify-start gap-4 rounded-none bg-transparent p-0"
            >
              <TabsTrigger value="participation" className={DETAIL_TAB_TRIGGER_CLASS}>
                Participation details
              </TabsTrigger>
              <TabsTrigger value="general" className={DETAIL_TAB_TRIGGER_CLASS}>
                General
              </TabsTrigger>
              <TabsTrigger value="hierarchy" className={DETAIL_TAB_TRIGGER_CLASS}>
                Hierarchy
              </TabsTrigger>
              <TabsTrigger value="activity" className={DETAIL_TAB_TRIGGER_CLASS}>
                Activity
              </TabsTrigger>
              <TabsTrigger value="performance" className={DETAIL_TAB_TRIGGER_CLASS}>
                Performance
              </TabsTrigger>
            </TabsList>
          </DetailTabList>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <TabsContent value="participation" className="mt-0 outline-none">
              <CampaignParticipationTab workspace={workspace} />
            </TabsContent>
            <TabsContent value="general" className="mt-0 outline-none">
              <CampaignGeneralTab
                workspace={workspace}
                tabCounts={tabCounts}
                onNavigateToTab={onNavigateToTab}
              />
            </TabsContent>
            <TabsContent value="hierarchy" className="mt-0 outline-none">
              <CampaignHierarchyTab workspace={workspace} />
            </TabsContent>
            <TabsContent value="activity" className="mt-0 outline-none">
              <CampaignActivityTab workspace={workspace} />
            </TabsContent>
            <TabsContent value="performance" className="mt-0 outline-none">
              <CampaignPerformanceTab
                workspace={workspace}
                onNavigateToTab={onNavigateToTab}
              />
            </TabsContent>
          </div>
        </Tabs>
      </OperationalDetailSheet>

      <CampaignEditSheet
        workspace={workspace}
        accountManagers={accountManagers}
        teams={teams}
        groups={groups}
        currencyOptions={currencyOptions}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
