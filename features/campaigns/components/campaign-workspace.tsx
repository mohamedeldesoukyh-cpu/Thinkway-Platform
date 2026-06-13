"use client";

import { useEffect, useMemo, useState } from "react";
import { CopyIcon, MoreHorizontalIcon, PencilIcon } from "lucide-react";

import { PageBackButton } from "@/components/navigation/page-back-button";
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
  CampaignWorkspaceSortableTabsBar,
  CampaignWorkspaceTabPanel,
} from "@/features/campaigns/components/campaign-workspace-tabs";
import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import { useCampaignWorkspaceTabOrder } from "@/features/campaigns/hooks/use-campaign-workspace-tab-order";
import { TabErrorBoundary } from "@/components/ui/tab-error-boundary";
import { CampaignDetailsSheet } from "@/features/campaigns/components/campaign-details-sheet";
import { CampaignKpiStrip } from "@/features/campaigns/components/campaign-kpi-strip";
import { CancelCampaignDialog } from "@/components/campaigns/cancel-campaign-dialog";
import { CampaignStatusBadge } from "@/features/campaigns/components/campaign-status-badge";
import { DuplicateCampaignDialog } from "@/features/campaigns/components/duplicate-campaign-dialog";
import { CampaignBillingTab } from "@/features/campaigns/components/tabs/campaign-billing-tab";
import { CampaignDeliverablesTab } from "@/features/campaigns/components/tabs/campaign-deliverables-tab";
import { CampaignAssignmentsTab } from "@/features/campaigns/components/tabs/campaign-assignments-tab";
import { CampaignPublicationsTab } from "@/features/campaigns/components/tabs/campaign-publications-tab";
import { CampaignOverviewTab } from "@/features/campaigns/components/tabs/campaign-overview-tab";
import { CampaignTimelineTab } from "@/features/campaigns/components/tabs/campaign-timeline-tab";
import { CampaignWorkflowTab } from "@/features/campaigns/components/tabs/campaign-workflow-tab";
import { ClientIoCampaignChrome } from "@/features/io/components/client-io-campaign-chrome";
import { ClientIoTab } from "@/features/io/components/client-io-tab";
import { VendorIoTab } from "@/features/io/components/vendor-io-tab";
import type { AssignmentBillingGroup, BillingLineRow, CampaignOperationalBillingDetail } from "@/features/billing/types";
import type { FinanceInvoiceRegisterRow } from "@/features/finance/invoices/types";
import type { FinanceAuditTimelineEntry } from "@/lib/finance/queries/finance-audit";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignPublicationRow } from "@/features/campaigns/queries/publications";
import { formatPlatformLabel } from "@/features/campaigns/utils";
import {
  OPERATIONAL_CHROME_LABEL,
  OPERATIONAL_CHROME_META,
  OPERATIONAL_CHROME_STATUS_BADGE,
  OPERATIONAL_CHROME_TITLE,
} from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { DocumentNumber } from "@/components/ui/document-number";
import { flattenOperationalDeliverables } from "@/lib/campaigns/flatten-operational-deliverables";
import { buildConsolidatedInvoiceQueueRows } from "@/lib/billing/consolidated-invoice-queue";
import { cn } from "@/lib/utils";
type CampaignWorkspaceViewProps = {
  workspace: import("@/features/campaigns/types").CampaignWorkspace;
  accountManagers: { id: string; full_name: string | null; email: string }[];
  teams: { id: string; name: string }[];
  billingLines: BillingLineRow[];
  billingGroups: AssignmentBillingGroup[];
  operationalBilling: CampaignOperationalBillingDetail | null;
  campaignInvoiceRegister: FinanceInvoiceRegisterRow[];
  assignmentHierarchy: AssignmentHierarchy;
  publications: CampaignPublicationRow[];
  publicationsLoadError?: string | null;
  currencyOptions: { value: string; label: string }[];
  financeAudit?: FinanceAuditTimelineEntry[];
};

export function CampaignWorkspaceView({
  workspace,
  accountManagers,
  teams,
  billingLines,
  billingGroups,
  operationalBilling,
  campaignInvoiceRegister,
  assignmentHierarchy,
  publications,
  publicationsLoadError,
  currencyOptions,
  financeAudit = [],
}: CampaignWorkspaceViewProps) {
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const { tabOrder, moveTab } = useCampaignWorkspaceTabOrder();

  const operationalDeliverableCount = useMemo(() => {
    return flattenOperationalDeliverables(
      assignmentHierarchy,
      publications,
      workspace.deliverables ?? []
    ).rows.length;
  }, [assignmentHierarchy, publications, workspace.deliverables]);

  const hierarchyLinkedInvoiceCount = useMemo(() => {
    const ids = new Set<string>();
    for (const group of assignmentHierarchy.groups) {
      if (group.line.invoice_id) ids.add(group.line.invoice_id);
      for (const deliverable of group.deliverables ?? []) {
        if (deliverable.invoice_id) ids.add(deliverable.invoice_id);
      }
    }
    return ids.size;
  }, [assignmentHierarchy.groups]);

  const billingTabCount = useMemo(() => {
    const registerCount = campaignInvoiceRegister.length;
    const linkedCount = Math.max(registerCount, hierarchyLinkedInvoiceCount);
    const queueCount = operationalBilling
      ? buildConsolidatedInvoiceQueueRows({
          campaign_header_id: workspace.id,
          campaign_document_number: workspace.document_number,
          campaign_name: workspace.name,
          client_name: workspace.client?.name ?? "—",
          brand_name: workspace.brand?.name ?? null,
          currency_code: operationalBilling.currency_code,
          operational_rows: operationalBilling.operational_rows,
        }).length
      : 0;
    return linkedCount + queueCount;
  }, [
    campaignInvoiceRegister.length,
    hierarchyLinkedInvoiceCount,
    operationalBilling,
    workspace,
  ]);

  const tabCounts = useMemo(
    () => ({
      lines: workspace.lines.length,
      clientIo: workspace.client_io ? 1 : 0,
      vendorIo: workspace.vendor_ios.length,
      deliverables: operationalDeliverableCount,
      publications: publications.length,
      workflow: workspace.approvals.length,
      billing: billingTabCount,
      timeline: workspace.vendors.length,
    }),
    [
      workspace.lines,
      workspace.client_io,
      workspace.vendor_ios.length,
      workspace.approvals.length,
      workspace.vendors.length,
      operationalDeliverableCount,
      publications.length,
      billingTabCount,
    ]
  );

  const tabsById = useMemo(
    (): Record<CampaignWorkspaceTabId, { value: string; label: string; count?: number }> => ({
      overview: { value: "overview", label: "Overview" },
      "client-io": {
        value: "client-io",
        label: "Client IO",
        count: tabCounts.clientIo,
      },
      lines: { value: "lines", label: "Assignments", count: tabCounts.lines },
      "vendor-io": { value: "vendor-io", label: "Vendor IO", count: tabCounts.vendorIo },
      deliverables: {
        value: "deliverables",
        label: "Deliverables",
        count: tabCounts.deliverables,
      },
      publications: {
        value: "publications",
        label: "Publications",
        count: tabCounts.publications,
      },
      workflow: { value: "workflow", label: "Workflow", count: tabCounts.workflow },
      billing: { value: "billing", label: "Billing", count: tabCounts.billing },
      timeline: {
        value: "timeline",
        label: "Timeline & activity",
        count: tabCounts.timeline,
      },
    }),
    [tabCounts]
  );

  const tabPanelClass =
    "mt-4 flex-none outline-none focus-visible:outline-none data-[state=inactive]:hidden";

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    console.debug("[sticky-header] campaign workspace sticky tabs mounted", {
      campaignId: workspace.id,
    });

    const arrayChecks: Record<string, unknown> = {
      lines: workspace.lines,
      vendor_ios: workspace.vendor_ios,
      approvals: workspace.approvals,
      vendors: workspace.vendors,
      deliverables: workspace.deliverables,
    };
    for (const [field, value] of Object.entries(arrayChecks)) {
      if (!Array.isArray(value)) {
        console.error("[campaign-workspace-trace] client:non-array-field", {
          campaignId: workspace.id,
          field,
          valueType: typeof value,
          keys: value != null && typeof value === "object" ? Object.keys(value as object) : [],
          json: JSON.stringify(value).slice(0, 1000),
        });
      }
    }

    if (operationalBilling?.operational_rows) {
      import("@/lib/billing/operational-billing-trace")
        .then(({ traceOperationalTreeStage }) => {
          traceOperationalTreeStage(
            "CampaignWorkspaceView:client-operational-rows",
            operationalBilling.operational_rows
          );
        })
        .catch((error) => {
          console.error("[campaign-workspace-trace] client operational tree check failed", error);
        });
    }
  }, [workspace.id, operationalBilling, workspace]);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.debug("[tab-highlight] active campaign tab", { tab: activeTab });
    }
  }, [activeTab]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
      >
        <CampaignWorkspaceScrollShell
          chrome={
            <>
              <div className="space-y-1 pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <PageBackButton
                      fallbackHref="/campaigns"
                      label="Back to campaigns"
                    />
                    <button
                      type="button"
                      onClick={() => setDetailsOpen(true)}
                      className={cn(
                        OPERATIONAL_CHROME_TITLE,
                        "truncate text-left transition-colors hover:text-primary"
                      )}
                      title="View campaign details"
                    >
                      {workspace.name}
                    </button>
                    <CampaignStatusBadge
                      status={workspace.status}
                      className={OPERATIONAL_CHROME_STATUS_BADGE}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <ClientIoCampaignChrome io={workspace.client_io} campaignId={workspace.id} />
                    {workspace.status !== "cancelled" ? (
                      <CancelCampaignDialog
                        campaignId={workspace.id}
                        campaignName={workspace.name}
                      />
                    ) : null}
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
                <p className={cn(OPERATIONAL_CHROME_META, "pl-10")}>
                  <DocumentNumber value={workspace.document_number} />
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
            </>
          }
          tabs={
            <CampaignWorkspaceSortableTabsBar
              tabOrder={tabOrder}
              tabsById={tabsById}
              onReorder={moveTab}
            />
          }
        >
        <TabsContent value="overview" className={tabPanelClass}>
          <CampaignWorkspaceTabPanel className="p-4 md:p-5">
            {activeTab === "overview" ? (
              <CampaignOverviewTab
                workspace={workspace}
                accountManagers={accountManagers}
                teams={teams}
                currencyOptions={currencyOptions}
                onOpenDetails={() => setDetailsOpen(true)}
              />
            ) : null}
          </CampaignWorkspaceTabPanel>
        </TabsContent>
        <TabsContent value="client-io" className={tabPanelClass}>
          <CampaignWorkspaceTabPanel>
            {activeTab === "client-io" ? (
              <TabErrorBoundary tabName="Client IO">
                <ClientIoTab
                  campaignId={workspace.id}
                  campaignName={workspace.name}
                  io={workspace.client_io}
                  recipients={workspace.client_io_send_recipients}
                  sendHistory={workspace.client_io_send_history}
                  senderName={workspace.client_io_sender_name}
                />
              </TabErrorBoundary>
            ) : null}
          </CampaignWorkspaceTabPanel>
        </TabsContent>
        <TabsContent value="lines" className={tabPanelClass}>
          <CampaignWorkspaceTabPanel>
            {activeTab === "lines" ? (
              <CampaignAssignmentsTab
                workspace={workspace}
                po={workspace.po}
                currencyOptions={currencyOptions}
                assignmentHierarchy={assignmentHierarchy}
                billingGroups={billingGroups}
                operationalBilling={operationalBilling}
              />
            ) : null}
          </CampaignWorkspaceTabPanel>
        </TabsContent>
        <TabsContent value="deliverables" className={tabPanelClass}>
          <CampaignWorkspaceTabPanel>
            {activeTab === "deliverables" ? (
              <TabErrorBoundary tabName="Deliverables">
                <CampaignDeliverablesTab
                  workspace={workspace}
                  assignmentHierarchy={assignmentHierarchy}
                  publications={publications}
                />
              </TabErrorBoundary>
            ) : null}
          </CampaignWorkspaceTabPanel>
        </TabsContent>
        <TabsContent value="vendor-io" className={tabPanelClass}>
          <CampaignWorkspaceTabPanel>
            {activeTab === "vendor-io" ? (
              <TabErrorBoundary tabName="Vendor IO">
                <VendorIoTab campaignId={workspace.id} rows={workspace.vendor_ios} />
              </TabErrorBoundary>
            ) : null}
          </CampaignWorkspaceTabPanel>
        </TabsContent>
        <TabsContent value="publications" className={tabPanelClass}>
          <CampaignWorkspaceTabPanel>
            {activeTab === "publications" ? (
              <TabErrorBoundary tabName="Publications">
                <CampaignPublicationsTab
                  workspace={workspace}
                  publications={publications}
                  loadError={publicationsLoadError}
                />
              </TabErrorBoundary>
            ) : null}
          </CampaignWorkspaceTabPanel>
        </TabsContent>
        <TabsContent value="workflow" className={tabPanelClass}>
          <CampaignWorkspaceTabPanel className="p-4 md:p-5">
            {activeTab === "workflow" ? (
              <TabErrorBoundary tabName="Workflow">
                <CampaignWorkflowTab workspace={workspace} />
              </TabErrorBoundary>
            ) : null}
          </CampaignWorkspaceTabPanel>
        </TabsContent>
        <TabsContent value="billing" className={tabPanelClass}>
          <CampaignWorkspaceTabPanel>
            {activeTab === "billing" ? (
              <TabErrorBoundary tabName="Billing">
                <CampaignBillingTab
                  workspace={workspace}
                  billingLines={billingLines}
                  billingGroups={billingGroups}
                  operationalBilling={operationalBilling}
                  campaignInvoiceRegister={campaignInvoiceRegister}
                />
              </TabErrorBoundary>
            ) : null}
          </CampaignWorkspaceTabPanel>
        </TabsContent>
        <TabsContent value="timeline" className={tabPanelClass}>
          <CampaignWorkspaceTabPanel className="p-4 md:p-5">
            {activeTab === "timeline" ? (
              <TabErrorBoundary tabName="Timeline">
                <CampaignTimelineTab
                  workspace={workspace}
                  assignmentHierarchy={assignmentHierarchy}
                  financeAudit={financeAudit}
                />
              </TabErrorBoundary>
            ) : null}
          </CampaignWorkspaceTabPanel>
        </TabsContent>
        </CampaignWorkspaceScrollShell>
      </Tabs>

      <CampaignDetailsSheet
        workspace={workspace}
        accountManagers={accountManagers}
        teams={teams}
        currencyOptions={currencyOptions}
        tabCounts={tabCounts}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onNavigateToTab={(tabId) => {
          setActiveTab(tabId);
          setDetailsOpen(false);
        }}
      />

      <DuplicateCampaignDialog
        workspace={workspace}
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
      />
    </div>
  );
}
