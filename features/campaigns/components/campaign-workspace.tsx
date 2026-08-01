"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CalendarRangeIcon, CopyIcon, FileTextIcon, MoreHorizontalIcon, PencilIcon } from "lucide-react";

import { EntityPrevNext } from "@/components/navigation/entity-prev-next";
import { PageBackButton } from "@/components/navigation/page-back-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs } from "@/components/ui/tabs";
import { CampaignWorkspaceScrollShell } from "@/features/campaigns/components/campaign-workspace-scroll-shell";
import {
  CampaignWorkspaceSortableTabsBar,
  CampaignWorkspaceTabContent,
  CampaignWorkspaceTabPanel,
} from "@/features/campaigns/components/campaign-workspace-tabs";
import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import { isCampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import { useCampaignWorkspaceTabOrder } from "@/features/campaigns/hooks/use-campaign-workspace-tab-order";
import { useCampaignTabData } from "@/features/campaigns/hooks/use-campaign-tab-data";
import { CampaignOperationalRefreshProvider } from "@/features/campaigns/hooks/campaign-operational-refresh";
import { useMetricsSyncCompletionToasts } from "@/features/campaigns/hooks/use-metrics-sync-toasts";
import { OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS } from "@/components/workspace/operational-workspace-ui";
import { TabErrorBoundary } from "@/components/ui/tab-error-boundary";
import { CampaignDetailsSheet } from "@/features/campaigns/components/campaign-details-sheet";
import { CancelCampaignDialog } from "@/components/campaigns/cancel-campaign-dialog";
import { CampaignHero } from "@/features/campaigns/components/aurora/campaign-hero";
import { CampaignKpiCards } from "@/features/campaigns/components/aurora/campaign-kpi-cards";
import { DuplicateCampaignDialog } from "@/features/campaigns/components/duplicate-campaign-dialog";
import { CampaignBillingTab } from "@/features/campaigns/components/tabs/campaign-billing-tab";
import { CampaignDeliverablesDocumentationTab } from "@/features/campaigns/components/tabs/campaign-deliverables-documentation-tab";
import { CampaignAssignmentsTab } from "@/features/campaigns/components/tabs/campaign-assignments-tab";
import { CampaignPerformanceCenterTab } from "@/features/campaigns/components/performance/campaign-performance-center-tab";
import { CampaignOverviewTab } from "@/features/campaigns/components/tabs/campaign-overview-tab";
import { CampaignTimelineTab } from "@/features/campaigns/components/tabs/campaign-timeline-tab";
import { CampaignWorkflowTab } from "@/features/campaigns/components/tabs/campaign-workflow-tab";
import { CampaignWorkspaceTabLoading } from "@/features/campaigns/components/campaign-workspace-tab-loading";
import { ClientIoCampaignChrome } from "@/features/io/components/client-io-campaign-chrome";
import { ClientIoTab } from "@/features/io/components/client-io-tab";
import { VendorIoTab } from "@/features/io/components/vendor-io-tab";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import { flattenOperationalDeliverables } from "@/lib/campaigns/flatten-operational-deliverables";
import { buildConsolidatedInvoiceQueueRows } from "@/lib/billing/consolidated-invoice-queue";
import { OpenCampaignStudioLauncher } from "@/features/campaign-outputs/components/open-campaign-studio-launcher-lazy";
import { seedFromCampaign } from "@/features/campaign-outputs/hydration/seed-adapters";
import { campaignDetailPath, campaignMediaPlanPath } from "@/lib/routing/entity-paths";

type CampaignWorkspaceViewProps = {
  workspace: CampaignWorkspace;
  defaultTab?: CampaignWorkspaceTabId;
  initialAssignmentHierarchy: AssignmentHierarchy;
};

export function CampaignWorkspaceView({
  workspace,
  defaultTab = "overview",
  initialAssignmentHierarchy,
}: CampaignWorkspaceViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CampaignWorkspaceTabId>(defaultTab);
  const { tabOrder, moveTab } = useCampaignWorkspaceTabOrder();

  const tabData = useCampaignTabData(workspace.id, initialAssignmentHierarchy);
  const {
    accountManagers,
    teams,
    groups,
    currencyOptions,
    assignmentHierarchy,
    billingGroups,
    operationalBilling,
    billingLines,
    campaignInvoiceRegister,
    publications,
    performanceSummary,
    performanceCharts,
    publicationsSyncHealth,
    publicationsLoadError,
    publicationsSchemaWarnings,
    financeAudit,
    isTabLoading,
    tabLoadError,
    bundleStatuses,
    reloadOperationalBilling,
    reloadPublications,
  } = tabData;

  useMetricsSyncCompletionToasts(publications);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const handleTabChange = useCallback(
    (value: string) => {
      if (!isCampaignWorkspaceTabId(value)) return;
      setActiveTab(value);
      const params = new URLSearchParams(searchParams.toString());
      if (value === "overview") {
        params.delete("tab");
      } else {
        params.set("tab", value);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const operationalDeliverableCount = useMemo(() => {
    if (bundleStatuses.publications === "loaded") {
      return flattenOperationalDeliverables(
        assignmentHierarchy,
        publications,
        workspace.deliverables ?? []
      ).rows.length;
    }
    if (assignmentHierarchy.groups.length > 0) {
      return flattenOperationalDeliverables(
        assignmentHierarchy,
        [],
        workspace.deliverables ?? []
      ).rows.length;
    }
    return workspace.deliverables?.length ?? 0;
  }, [
    assignmentHierarchy,
    publications,
    workspace.deliverables,
    bundleStatuses.publications,
  ]);

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
    if (bundleStatuses.billing !== "loaded" && bundleStatuses.assignmentsBilling !== "loaded") {
      return undefined;
    }
    const registerCount = campaignInvoiceRegister.length;
    const linkedCount = Math.max(
      registerCount,
      hierarchyLinkedInvoiceCount ?? 0
    );
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
    bundleStatuses.billing,
    bundleStatuses.assignmentsBilling,
  ]);

  const tabCounts = useMemo(
    () => ({
      lines: workspace.lines.length,
      clientIo: workspace.client_io ? 1 : 0,
      vendorIo: workspace.vendor_ios.length,
      deliverables: operationalDeliverableCount,
      publications:
        bundleStatuses.publications === "loaded"
          ? publications.length
          : undefined,
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
      bundleStatuses.publications,
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
        label: "Performance",
        count: tabCounts.publications,
      },
      workflow: { value: "workflow", label: "Workflow", count: tabCounts.workflow },
      billing: { value: "billing", label: "Finance", count: tabCounts.billing },
      timeline: {
        value: "timeline",
        label: "Timeline",
        count: tabCounts.timeline,
      },
    }),
    [tabCounts]
  );

  const tabPanelClass = OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS;

  const renderTabContent = (tabId: CampaignWorkspaceTabId, content: React.ReactNode) => {
    if (isTabLoading(tabId) || tabLoadError(tabId)) {
      return <CampaignWorkspaceTabLoading error={tabLoadError(tabId)} />;
    }
    return content;
  };

  const campaignStudioSeed = useMemo(
    () =>
      seedFromCampaign({
        name: workspace.name,
        brief: workspace.brief,
        platform: workspace.platform,
        currency_code: workspace.currency_code,
        client: workspace.client,
        brand: workspace.brand,
        group: workspace.group,
        financials: { budget: workspace.financials.budget },
      }),
    [workspace]
  );

  const campaignStudioWorkspace = useMemo(
    () => ({ type: "campaign" as const, id: workspace.id }),
    [workspace.id]
  );

  return (
    <CampaignOperationalRefreshProvider
      reloadOperationalBilling={reloadOperationalBilling}
      reloadPublications={reloadPublications}
    >
    <div className="thinkway-campaign-workspace flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
      >
        <CampaignWorkspaceScrollShell
          chrome={
            <div className="thinkway-aurora-chrome">
              <div className="thinkway-aurora-chrome-nav">
                <PageBackButton
                  fallbackHref="/campaigns"
                  label="Back to campaigns"
                  className="thinkway-campaign-back-btn size-[26px] rounded-[var(--camp-radius)] p-0 hover:bg-[var(--camp-surface)]"
                />
                <EntityPrevNext
                  entity="campaigns"
                  currentId={workspace.id}
                  hrefForId={(id) => campaignDetailPath(id)}
                />
              </div>
              <CampaignHero
                workspace={workspace}
                actions={
                  <>
                    <OpenCampaignStudioLauncher
                      seed={campaignStudioSeed}
                      workspace={campaignStudioWorkspace}
                      tab="studio"
                      variant="primary"
                      buttonClassName="thinkway-campaign-btn thinkway-campaign-btn-primary h-[38px] px-[15px] text-[13px] font-semibold"
                    />
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="thinkway-campaign-btn"
                    >
                      <Link
                        href={campaignMediaPlanPath({
                          id: workspace.id,
                          document_number: workspace.document_number,
                          name: workspace.name,
                        })}
                      >
                        <CalendarRangeIcon className="size-3.5" />
                        Media Plans
                      </Link>
                    </Button>
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
                          size="icon"
                          className="thinkway-campaign-btn size-[38px] p-0"
                          aria-label="Campaign actions"
                        >
                          <MoreHorizontalIcon className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <a
                            href={`/api/campaigns/${workspace.id}/performance/document?format=pdf&download=1`}
                          >
                            <FileTextIcon className="size-4" />
                            Generate Performance Report
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDuplicateOpen(true)}>
                          <CopyIcon className="size-4" />
                          Duplicate campaign
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            handleTabChange("overview");
                          }}
                        >
                          <PencilIcon className="size-4" />
                          Edit header (Overview tab)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDetailsOpen(true)}>
                          Campaign details
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                }
              />
              <CampaignKpiCards workspace={workspace} />
            </div>
          }
          tabs={
            <CampaignWorkspaceSortableTabsBar
              tabOrder={tabOrder}
              tabsById={tabsById}
              onReorder={moveTab}
            />
          }
        >
        <CampaignWorkspaceTabContent value="overview" className={tabPanelClass}>
          <CampaignWorkspaceTabPanel>
            <CampaignOverviewTab
              workspace={workspace}
              assignmentHierarchy={assignmentHierarchy}
              accountManagers={accountManagers}
              teams={teams}
              groups={groups}
              currencyOptions={currencyOptions}
              onOpenDetails={() => setDetailsOpen(true)}
            />
          </CampaignWorkspaceTabPanel>
        </CampaignWorkspaceTabContent>
        <CampaignWorkspaceTabContent value="client-io" className={tabPanelClass}>
          <CampaignWorkspaceTabPanel>
            <TabErrorBoundary tabName="Client IO">
              <ClientIoTab
                campaignId={workspace.id}
                campaignName={workspace.name}
                io={workspace.client_io}
                recipients={workspace.client_io_send_recipients}
                sendHistory={workspace.client_io_send_history}
                senderName={workspace.client_io_sender_name}
                currencyCode={workspace.currency_code}
                assignments={workspace.lines.map((line) => ({
                  id: line.id,
                  document_number: line.document_number,
                  name: line.name,
                  influencer_name: line.influencer_name,
                  revenue_before_vat: line.revenue_before_vat,
                  currency_code: workspace.currency_code,
                }))}
                versions={workspace.client_io_versions ?? []}
                milestones={workspace.client_io_milestones ?? []}
              />
            </TabErrorBoundary>
          </CampaignWorkspaceTabPanel>
        </CampaignWorkspaceTabContent>
        <CampaignWorkspaceTabContent value="lines" className={tabPanelClass}>
          <CampaignWorkspaceTabPanel>
            {tabLoadError("lines") ? (
              <CampaignWorkspaceTabLoading error={tabLoadError("lines")} />
            ) : (
              <TabErrorBoundary tabName="Assignments">
                <CampaignAssignmentsTab
                  workspace={workspace}
                  po={workspace.po}
                  currencyOptions={currencyOptions}
                  assignmentHierarchy={assignmentHierarchy}
                  billingGroups={billingGroups}
                  operationalBilling={operationalBilling}
                />
              </TabErrorBoundary>
            )}
          </CampaignWorkspaceTabPanel>
        </CampaignWorkspaceTabContent>
        <CampaignWorkspaceTabContent value="deliverables" className={tabPanelClass}>
          <CampaignWorkspaceTabPanel>
            {renderTabContent(
              "deliverables",
              <TabErrorBoundary tabName="Deliverables">
                <CampaignDeliverablesDocumentationTab
                  workspace={workspace}
                  assignmentHierarchy={assignmentHierarchy}
                  initialCreatorFilter={searchParams.get("docsCreator")}
                />
              </TabErrorBoundary>
            )}
          </CampaignWorkspaceTabPanel>
        </CampaignWorkspaceTabContent>
        <CampaignWorkspaceTabContent value="vendor-io" className={tabPanelClass}>
          <CampaignWorkspaceTabPanel>
            <TabErrorBoundary tabName="Vendor IO">
              <VendorIoTab campaignId={workspace.id} rows={workspace.vendor_ios} />
            </TabErrorBoundary>
          </CampaignWorkspaceTabPanel>
        </CampaignWorkspaceTabContent>
        <CampaignWorkspaceTabContent value="publications" className={tabPanelClass}>
          <CampaignWorkspaceTabPanel>
            {renderTabContent(
              "publications",
              <TabErrorBoundary tabName="Performance">
                <CampaignPerformanceCenterTab
                  workspace={workspace}
                  publications={publications}
                  summary={performanceSummary}
                  charts={performanceCharts}
                  syncHealth={publicationsSyncHealth}
                  loadError={publicationsLoadError}
                  schemaWarnings={publicationsSchemaWarnings}
                />
              </TabErrorBoundary>
            )}
          </CampaignWorkspaceTabPanel>
        </CampaignWorkspaceTabContent>
        <CampaignWorkspaceTabContent value="workflow" className={tabPanelClass}>
          <CampaignWorkspaceTabPanel>
            <TabErrorBoundary tabName="Workflow">
              <CampaignWorkflowTab workspace={workspace} />
            </TabErrorBoundary>
          </CampaignWorkspaceTabPanel>
        </CampaignWorkspaceTabContent>
        <CampaignWorkspaceTabContent value="billing" className={tabPanelClass}>
          <CampaignWorkspaceTabPanel>
            {renderTabContent(
              "billing",
              <TabErrorBoundary tabName="Billing">
                <CampaignBillingTab
                  workspace={workspace}
                  billingLines={billingLines}
                  billingGroups={billingGroups}
                  operationalBilling={operationalBilling}
                  campaignInvoiceRegister={campaignInvoiceRegister}
                />
              </TabErrorBoundary>
            )}
          </CampaignWorkspaceTabPanel>
        </CampaignWorkspaceTabContent>
        <CampaignWorkspaceTabContent value="timeline" className={tabPanelClass}>
          <CampaignWorkspaceTabPanel>
            {renderTabContent(
              "timeline",
              <TabErrorBoundary tabName="Timeline">
                <CampaignTimelineTab
                  workspace={workspace}
                  assignmentHierarchy={assignmentHierarchy}
                  financeAudit={financeAudit}
                  financeAuditStatus={bundleStatuses.financeAudit}
                />
              </TabErrorBoundary>
            )}
          </CampaignWorkspaceTabPanel>
        </CampaignWorkspaceTabContent>
        </CampaignWorkspaceScrollShell>
      </Tabs>

      <CampaignDetailsSheet
        workspace={workspace}
        accountManagers={accountManagers}
        teams={teams}
        groups={groups}
        currencyOptions={currencyOptions}
        tabCounts={{
          lines: tabCounts.lines,
          vendorIo: tabCounts.vendorIo,
          deliverables: tabCounts.deliverables,
          publications: tabCounts.publications ?? 0,
          workflow: tabCounts.workflow,
          billing: tabCounts.billing ?? 0,
        }}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onNavigateToTab={(tabId) => {
          handleTabChange(tabId);
          setDetailsOpen(false);
        }}
      />

      <DuplicateCampaignDialog
        workspace={workspace}
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
      />
    </div>
    </CampaignOperationalRefreshProvider>
  );
}
