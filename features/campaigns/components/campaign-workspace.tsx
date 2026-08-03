"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { EntityPrevNext } from "@/components/navigation/entity-prev-next";
import { PageBackButton } from "@/components/navigation/page-back-button";
import { Tabs } from "@/components/ui/tabs";
import { CampaignWorkspaceScrollShell } from "@/features/campaigns/components/campaign-workspace-scroll-shell";
import {
  CampaignWorkspaceSortableTabsBar,
  CampaignWorkspaceTabContent,
  CampaignWorkspaceTabPanel,
} from "@/features/campaigns/components/campaign-workspace-tabs";
import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import {
  isCampaignWorkspaceTabId,
  resolveCampaignWorkspaceTab,
} from "@/features/campaigns/constants/campaign-workspace-tab-order";
import {
  buildWorkspaceGuidance,
  campaignLifecycleFromWorkspace,
  workspaceLabelForTab,
} from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import {
  buildCampaignWorkspaceTabUrl,
} from "@/features/campaigns/lifecycle/campaign-workspace-entry-routing";
import {
  isBillingInvoiceCreationUnlocked,
  type DecisionFocusQuery,
} from "@/features/campaigns/lifecycle/campaign-decision-center";
import { CampaignBlockerResolverDrawer } from "@/features/campaigns/lifecycle/components/campaign-blocker-resolver-drawer";
import { CampaignStateStrip } from "@/features/campaigns/lifecycle/components/campaign-state-strip";
import { CampaignVendorIoLifecycleBanner } from "@/features/campaigns/lifecycle/components/campaign-vendor-io-lifecycle-banner";
import { CampaignWorkspaceGuidance } from "@/features/campaigns/lifecycle/components/campaign-workspace-guidance";
import {
  campaignProcessCueFromWorkspace,
  processNavStateForTab,
  signalsFromCampaignWorkspace,
} from "@/features/campaigns/lifecycle/campaign-process-presentation";
import { useCampaignWorkspaceTabOrder } from "@/features/campaigns/hooks/use-campaign-workspace-tab-order";
import { useCampaignTabData } from "@/features/campaigns/hooks/use-campaign-tab-data";
import { CampaignOperationalRefreshProvider } from "@/features/campaigns/hooks/campaign-operational-refresh";
import { useMetricsSyncCompletionToasts } from "@/features/campaigns/hooks/use-metrics-sync-toasts";
import { OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS } from "@/components/workspace/operational-workspace-ui";
import { TabErrorBoundary } from "@/components/ui/tab-error-boundary";
import { CampaignDetailsSheet } from "@/features/campaigns/components/campaign-details-sheet";
import { CampaignHero } from "@/features/campaigns/components/aurora/campaign-hero";
import { CampaignHeroActions } from "@/features/campaigns/components/aurora/campaign-hero-actions";
import { CampaignKpiCards } from "@/features/campaigns/components/aurora/campaign-kpi-cards";
import { DuplicateCampaignDialog } from "@/features/campaigns/components/duplicate-campaign-dialog";
import { CampaignBillingTab } from "@/features/campaigns/components/tabs/campaign-billing-tab";
import { CampaignDeliverablesTab } from "@/features/campaigns/components/tabs/campaign-deliverables-tab";
import { CampaignDeliverablesDocumentationTab } from "@/features/campaigns/components/tabs/campaign-deliverables-documentation-tab";
import { CampaignAssignmentsTab } from "@/features/campaigns/components/tabs/campaign-assignments-tab";
import { CampaignPerformanceCenterTab } from "@/features/campaigns/components/performance/campaign-performance-center-tab";
import { CampaignOverviewTab } from "@/features/campaigns/components/tabs/campaign-overview-tab";
import { CampaignTimelineTab } from "@/features/campaigns/components/tabs/campaign-timeline-tab";
import { CampaignWorkflowTab } from "@/features/campaigns/components/tabs/campaign-workflow-tab";
import { CampaignWorkspaceTabLoading } from "@/features/campaigns/components/campaign-workspace-tab-loading";
import { ClientIoTab } from "@/features/io/components/client-io-tab";
import { VendorIoTab } from "@/features/io/components/vendor-io-tab";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import { flattenOperationalDeliverables } from "@/lib/campaigns/flatten-operational-deliverables";
import { buildConsolidatedInvoiceQueueRows } from "@/lib/billing/consolidated-invoice-queue";
import { seedFromCampaign } from "@/features/campaign-outputs/hydration/seed-adapters";
import { campaignDetailPath } from "@/lib/routing/entity-paths";
import { DocumentNumber } from "@/components/ui/document-number";
import { EnvironmentBadgeSlot } from "@/components/environment/environment-badge-slot";

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [resolverOpen, setResolverOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CampaignWorkspaceTabId>(defaultTab);
  const campaignIdRef = useRef(workspace.id);
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

  // Reset tab only when switching campaigns — never when server props refresh.
  // Syncing on every defaultTab change raced RSC remounts and bounced users to
  // the entry stage (Client IO / Needs Attention) a few seconds after any tab click.
  useEffect(() => {
    if (campaignIdRef.current === workspace.id) return;
    campaignIdRef.current = workspace.id;
    setActiveTab(defaultTab);
  }, [workspace.id, defaultTab]);

  useEffect(() => {
    const onPopState = () => {
      const tab = new URL(window.location.href).searchParams.get("tab");
      setActiveTab(resolveCampaignWorkspaceTab(tab ?? undefined));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handleTabChange = useCallback(
    (value: string, focus?: DecisionFocusQuery | null) => {
      if (!isCampaignWorkspaceTabId(value)) return;
      setActiveTab(value);
      // history.replaceState (not router.replace): keep ?tab= in the address bar
      // without refetching the campaign page. router.replace remounted via loading.tsx
      // after the slow workspace load and snapped back to the entry stage.
      if (typeof window === "undefined") return;
      const url = buildCampaignWorkspaceTabUrl(
        pathname,
        window.location.search,
        value,
        focus
      );
      window.history.replaceState(window.history.state, "", url);
    },
    [pathname]
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

  const processCue = useMemo(
    () => campaignProcessCueFromWorkspace(workspace),
    [workspace]
  );
  const processSignals = useMemo(
    () => signalsFromCampaignWorkspace(workspace),
    [workspace]
  );
  const lifecycle = useMemo(
    () => campaignLifecycleFromWorkspace(workspace),
    [workspace]
  );
  // Primary CTAs open the exact business object (tab + focus query).
  const continueToNextAction = useCallback(() => {
    handleTabChange(
      lifecycle.decisionCenter.primaryActionTab,
      lifecycle.decisionCenter.primaryFocusQuery
    );
  }, [
    handleTabChange,
    lifecycle.decisionCenter.primaryActionTab,
    lifecycle.decisionCenter.primaryFocusQuery,
  ]);

  const invoiceCreationUnlocked = useMemo(
    () =>
      isBillingInvoiceCreationUnlocked({
        businessStageId: lifecycle.businessStageId,
        billingSignal: lifecycle.processCue.stageSignals.billing,
        invoiceCount: processSignals.invoiceCount,
      }),
    [
      lifecycle.businessStageId,
      lifecycle.processCue.stageSignals.billing,
      processSignals.invoiceCount,
    ]
  );

  const renderWithLifecycleGuidance = (
    tabId: CampaignWorkspaceTabId,
    content: React.ReactNode
  ) => (
    <>
      <CampaignWorkspaceGuidance
        guidance={buildWorkspaceGuidance(lifecycle, tabId)}
        onContinue={continueToNextAction}
      />
      {content}
    </>
  );

  const tabsById = useMemo(
    (): Record<
      CampaignWorkspaceTabId,
      { value: string; label: string; count?: number; processState?: ReturnType<typeof processNavStateForTab> }
    > => {
      const defs: Record<
        CampaignWorkspaceTabId,
        { value: string; label: string; count?: number }
      > = {
        overview: { value: "overview", label: "Overview" },
        "client-io": {
          value: "client-io",
          label: "Client IO",
          count: tabCounts.clientIo,
        },
        lines: { value: "lines", label: "Assignments", count: tabCounts.lines },
        "vendor-io": {
          value: "vendor-io",
          label: "Vendor IO",
          count: tabCounts.vendorIo,
        },
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
      };
      return (Object.keys(defs) as CampaignWorkspaceTabId[]).reduce(
        (acc, tabId) => {
          acc[tabId] = {
            ...defs[tabId],
            processState: processNavStateForTab(tabId, processCue, processSignals),
          };
          return acc;
        },
        {} as Record<
          CampaignWorkspaceTabId,
          {
            value: string;
            label: string;
            count?: number;
            processState?: ReturnType<typeof processNavStateForTab>;
          }
        >
      );
    },
    [tabCounts, processCue, processSignals]
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
              <div className="thinkway-aurora-topbar">
                <div className="thinkway-aurora-crumb">
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
                  <span className="thinkway-aurora-crumb-path">
                    <Link href="/campaigns" className="hover:text-[var(--camp-blue-text)]">
                      Campaigns
                    </Link>
                    <span className="thinkway-aurora-sep">/</span>
                    <b>
                      <DocumentNumber value={workspace.document_number} />
                    </b>
                    <span className="thinkway-aurora-sep">·</span>
                    <span className="thinkway-lc-crumb-state" title={lifecycle.reason}>
                      {lifecycle.businessStageLabel}
                      <span className="thinkway-lc-pill ml-1.5">
                        {lifecycle.businessStateLabel}
                      </span>
                    </span>
                  </span>
                </div>
                <div className="thinkway-aurora-topbar-right">
                  <EnvironmentBadgeSlot />
                </div>
              </div>
              <CampaignHero
                workspace={workspace}
                processCue={processCue}
                lifecycle={lifecycle}
                activeWorkspaceTab={activeTab}
                onNavigateToCurrentStage={continueToNextAction}
                onOpenResolver={() => setResolverOpen(true)}
                onSelectStage={handleTabChange}
                actions={
                  <CampaignHeroActions
                    workspace={workspace}
                    studioSeed={campaignStudioSeed}
                    studioWorkspace={campaignStudioWorkspace}
                    onNavigateToTab={handleTabChange}
                    onDuplicate={() => setDuplicateOpen(true)}
                    onOpenDetails={() => setDetailsOpen(true)}
                  />
                }
              />
              <CampaignKpiCards workspace={workspace} />
            </div>
          }
          tabs={
            <>
              <CampaignStateStrip
                lifecycle={lifecycle}
                documentNumber={workspace.document_number}
                campaignName={workspace.name}
                workspaceLabel={workspaceLabelForTab(activeTab)}
                updatedAt={workspace.activity[0]?.created_at ?? workspace.start_date}
                endDate={workspace.end_date}
              />
              <CampaignWorkspaceSortableTabsBar
                tabOrder={tabOrder}
                tabsById={tabsById}
                onReorder={moveTab}
              />
            </>
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
              lifecycle={lifecycle}
              onOpenDetails={() => setDetailsOpen(true)}
              onNavigateToTab={handleTabChange}
              onOpenResolver={() => setResolverOpen(true)}
              onContinueLifecycle={continueToNextAction}
              performanceSummary={performanceSummary}
              performanceLoaded={bundleStatuses.publications === "loaded"}
            />
          </CampaignWorkspaceTabPanel>
        </CampaignWorkspaceTabContent>
        <CampaignWorkspaceTabContent value="client-io" className={tabPanelClass}>
          <CampaignWorkspaceTabPanel>
            {renderWithLifecycleGuidance(
              "client-io",
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
                  forceOpenRegister={
                    Boolean(searchParams.get("io")) &&
                    (!workspace.client_io ||
                      searchParams.get("io") === workspace.client_io.id)
                  }
                />
              </TabErrorBoundary>
            )}
          </CampaignWorkspaceTabPanel>
        </CampaignWorkspaceTabContent>
        <CampaignWorkspaceTabContent value="lines" className={tabPanelClass}>
          <CampaignWorkspaceTabPanel>
            {tabLoadError("lines") ? (
              <CampaignWorkspaceTabLoading error={tabLoadError("lines")} />
            ) : (
              renderWithLifecycleGuidance(
                "lines",
                <TabErrorBoundary tabName="Assignments">
                  <CampaignAssignmentsTab
                    workspace={workspace}
                    po={workspace.po}
                    currencyOptions={currencyOptions}
                    assignmentHierarchy={assignmentHierarchy}
                    billingGroups={billingGroups}
                    operationalBilling={operationalBilling}
                    initialFocusLineId={searchParams.get("line")}
                  />
                </TabErrorBoundary>
              )
            )}
          </CampaignWorkspaceTabPanel>
        </CampaignWorkspaceTabContent>
        <CampaignWorkspaceTabContent value="deliverables" className={tabPanelClass}>
          <CampaignWorkspaceTabPanel>
            {renderTabContent(
              "deliverables",
              renderWithLifecycleGuidance(
                "deliverables",
                <TabErrorBoundary tabName="Deliverables">
                  {/*
                    STAB-007: tab badge counts operational deliverable units.
                    Default surface must be the operational explorer (not empty documentation repo).
                    Documentation remains available via deep-link (?docsCreator= / ?deliverable=).
                  */}
                  {searchParams.get("docsCreator") || searchParams.get("deliverable") ? (
                    <CampaignDeliverablesDocumentationTab
                      workspace={workspace}
                      assignmentHierarchy={assignmentHierarchy}
                      initialCreatorFilter={searchParams.get("docsCreator")}
                      initialDeliverableId={searchParams.get("deliverable")}
                    />
                  ) : (
                    <CampaignDeliverablesTab
                      workspace={workspace}
                      assignmentHierarchy={assignmentHierarchy}
                      publications={publications}
                    />
                  )}
                </TabErrorBoundary>
              )
            )}
          </CampaignWorkspaceTabPanel>
        </CampaignWorkspaceTabContent>
        <CampaignWorkspaceTabContent value="vendor-io" className={tabPanelClass}>
          <CampaignWorkspaceTabPanel>
            {renderWithLifecycleGuidance(
              "vendor-io",
              <TabErrorBoundary tabName="Vendor IO">
                <CampaignVendorIoLifecycleBanner
                  lifecycle={lifecycle}
                  rows={workspace.vendor_ios}
                />
                <VendorIoTab
                  campaignId={workspace.id}
                  rows={workspace.vendor_ios}
                  initialSelectedId={searchParams.get("io")}
                />
              </TabErrorBoundary>
            )}
          </CampaignWorkspaceTabPanel>
        </CampaignWorkspaceTabContent>
        <CampaignWorkspaceTabContent value="publications" className={tabPanelClass}>
          <CampaignWorkspaceTabPanel>
            {renderTabContent(
              "publications",
              renderWithLifecycleGuidance(
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
                    initialDetailPublicationId={searchParams.get("publication")}
                  />
                </TabErrorBoundary>
              )
            )}
          </CampaignWorkspaceTabPanel>
        </CampaignWorkspaceTabContent>
        <CampaignWorkspaceTabContent value="workflow" className={tabPanelClass}>
          <CampaignWorkspaceTabPanel>
            {renderWithLifecycleGuidance(
              "workflow",
              <TabErrorBoundary tabName="Workflow">
                <CampaignWorkflowTab
                  workspace={workspace}
                  initialDetailApprovalId={searchParams.get("approval")}
                />
              </TabErrorBoundary>
            )}
          </CampaignWorkspaceTabPanel>
        </CampaignWorkspaceTabContent>
        <CampaignWorkspaceTabContent value="billing" className={tabPanelClass}>
          <CampaignWorkspaceTabPanel>
            {renderTabContent(
              "billing",
              renderWithLifecycleGuidance(
                "billing",
                <TabErrorBoundary tabName="Billing">
                  <CampaignBillingTab
                    workspace={workspace}
                    billingLines={billingLines}
                    billingGroups={billingGroups}
                    operationalBilling={operationalBilling}
                    campaignInvoiceRegister={campaignInvoiceRegister}
                    invoiceCreationUnlocked={invoiceCreationUnlocked}
                    invoiceUnlockHint={
                      lifecycle.decisionCenter.blockers[0]?.reason ||
                      lifecycle.decisionCenter.continueReason ||
                      null
                    }
                    onNavigateToLifecycleAction={continueToNextAction}
                    initialDetailInvoiceId={searchParams.get("invoice")}
                    initialDetailPaymentId={searchParams.get("payment")}
                  />
                </TabErrorBoundary>
              )
            )}
          </CampaignWorkspaceTabPanel>
        </CampaignWorkspaceTabContent>
        <CampaignWorkspaceTabContent value="timeline" className={tabPanelClass}>
          <CampaignWorkspaceTabPanel>
            {renderTabContent(
              "timeline",
              renderWithLifecycleGuidance(
                "timeline",
                <TabErrorBoundary tabName="Timeline">
                  <CampaignTimelineTab
                    workspace={workspace}
                    assignmentHierarchy={assignmentHierarchy}
                    financeAudit={financeAudit}
                    financeAuditStatus={bundleStatuses.financeAudit}
                    initialDetailActivityId={searchParams.get("activity")}
                  />
                </TabErrorBoundary>
              )
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

      <CampaignBlockerResolverDrawer
        open={resolverOpen}
        onOpenChange={setResolverOpen}
        lifecycle={lifecycle}
        onResolveAction={handleTabChange}
      />
    </div>
    </CampaignOperationalRefreshProvider>
  );
}
