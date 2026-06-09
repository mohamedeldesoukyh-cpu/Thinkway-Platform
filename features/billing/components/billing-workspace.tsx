"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";

import { Tabs, TabsContent } from "@/components/ui/tabs";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import {
  OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS,
  OperationalWorkspaceSortableTabsBar,
  OperationalWorkspaceTabPanel,
  type OperationalWorkspaceTabDef,
} from "@/components/workspace/operational-workspace-ui";
import { useWorkspaceTabOrder } from "@/hooks/use-workspace-tab-order";
import {
  BILLING_WORKSPACE_TAB_ORDER,
  BILLING_WORKSPACE_TAB_STORAGE_KEY,
  isBillingWorkspaceTabId,
  type BillingWorkspaceTabId,
} from "@/lib/workspace/platform-workspace-tabs";
import { operationalColumnsFromMetas } from "@/lib/tables/operational-filter-columns";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import {
  BILLING_CAMPAIGN_QUEUE_FILTER_ACCESSORS,
  BILLING_COLLECTION_TRACKER_FILTER_ACCESSORS,
  BILLING_FINANCIAL_APPROVALS_FILTER_ACCESSORS,
  BILLING_INVOICES_FILTER_ACCESSORS,
  BILLING_VENDOR_BATCHES_FILTER_ACCESSORS,
} from "@/lib/tables/workspace-table-filter-fields";
import { AgingReport } from "@/features/billing/components/aging-report";
import {
  BILLING_FINANCIAL_APPROVALS_COLUMN_METAS,
  BillingApprovalsPanel,
} from "@/features/billing/components/billing-approvals-panel";
import {
  BILLING_CAMPAIGN_QUEUE_COLUMN_METAS,
  BillingCampaignQueueTable,
} from "@/features/billing/components/billing-campaign-queue-table";
import {
  BILLING_INVOICES_COLUMN_METAS,
  BILLING_INVOICES_TABLE_COLUMNS,
  BILLING_VENDOR_BATCHES_COLUMN_METAS,
  BILLING_VENDOR_BATCHES_TABLE_COLUMNS,
  BillingInvoicesTable,
  VendorBatchesCard,
} from "@/features/billing/components/billing-invoices-table";
import { BillingKpiStrip } from "@/features/billing/components/billing-kpi-strip";
import {
  BILLING_COLLECTION_TRACKER_COLUMN_METAS,
  BILLING_COLLECTION_TRACKER_TABLE_COLUMNS,
  CollectionTracker,
} from "@/features/billing/components/collection-tracker";
import type { BillingDashboard } from "@/features/billing/types";

type BillingWorkspaceViewProps = {
  dashboard: BillingDashboard;
};

function BillingTabSectionHeader({
  title,
  description,
  settingsLabel,
}: {
  title: string;
  description?: string;
  settingsLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-4 py-2.5 md:px-5">
      <div className="min-w-0 space-y-0.5">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? (
          <p className="text-[11px] leading-snug text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <OperationalTableControlsSlot contextLabel={settingsLabel} />
    </div>
  );
}

function BillingTabTableShell({
  title,
  description,
  settingsLabel,
  children,
}: {
  title: string;
  description?: string;
  settingsLabel: string;
  children: ReactNode;
}) {
  return (
    <OperationalTableSection wide tableOnly cardSurface>
      <BillingTabSectionHeader
        title={title}
        description={description}
        settingsLabel={settingsLabel}
      />
      {children}
    </OperationalTableSection>
  );
}

export function BillingWorkspaceView({ dashboard }: BillingWorkspaceViewProps) {
  const queueCurrencies = useMemo(
    () => [...new Set(dashboard.campaign_queue.map((row) => row.currency_code))],
    [dashboard.campaign_queue]
  );

  const kpiCurrency = queueCurrencies.length === 1 ? queueCurrencies[0] : undefined;
  const mixedCurrency = queueCurrencies.length > 1;
  const openInvoices = useMemo(
    () => dashboard.invoices.filter((invoice) => invoice.outstanding > 0),
    [dashboard.invoices]
  );
  const campaignQueueColumns = useMemo(
    () =>
      operationalColumnsFromMetas(
        BILLING_CAMPAIGN_QUEUE_COLUMN_METAS,
        BILLING_CAMPAIGN_QUEUE_FILTER_ACCESSORS
      ),
    []
  );
  const collectionTrackerColumns = useMemo(
    () =>
      operationalColumnsFromMetas(
        BILLING_COLLECTION_TRACKER_COLUMN_METAS,
        BILLING_COLLECTION_TRACKER_FILTER_ACCESSORS
      ),
    []
  );
  const financialApprovalsColumns = useMemo(
    () =>
      operationalColumnsFromMetas(
        BILLING_FINANCIAL_APPROVALS_COLUMN_METAS,
        BILLING_FINANCIAL_APPROVALS_FILTER_ACCESSORS
      ),
    []
  );

  const { tabOrder, moveTab } = useWorkspaceTabOrder({
    storageKey: BILLING_WORKSPACE_TAB_STORAGE_KEY,
    defaultOrder: BILLING_WORKSPACE_TAB_ORDER,
    isValidId: isBillingWorkspaceTabId,
  });

  const tabsById = useMemo(
    (): Record<BillingWorkspaceTabId, OperationalWorkspaceTabDef> => ({
      queue: {
        value: "queue",
        label: "Billing queue",
        count: dashboard.campaign_queue.length,
      },
      overview: { value: "overview", label: "Overview" },
      invoices: {
        value: "invoices",
        label: "Invoices",
        count: dashboard.invoices.length,
      },
      collections: { value: "collections", label: "Collections" },
      aging: { value: "aging", label: "Aging" },
      approvals: {
        value: "approvals",
        label: "Approvals",
        count: dashboard.pending_approvals.length,
      },
      vendors: { value: "vendors", label: "Vendor payments" },
    }),
    [
      dashboard.campaign_queue.length,
      dashboard.invoices.length,
      dashboard.pending_approvals.length,
    ]
  );

  return (
    <div className="space-y-4">
      <BillingKpiStrip
        kpis={dashboard.kpis}
        currency={kpiCurrency}
        mixedCurrency={mixedCurrency}
      />

      <Tabs defaultValue="queue" className="flex flex-col gap-0">
        <OperationalWorkspaceSortableTabsBar
          sectionLabel="Billing workspace"
          tabOrder={tabOrder}
          tabsById={tabsById}
          onReorder={moveTab}
        />

        <TabsContent value="queue" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel>
            <OperationalTableSuiteProvider
              tableId={OPERATIONAL_TABLE_IDS.billingCampaignQueue}
              columns={campaignQueueColumns}
              rows={dashboard.campaign_queue}
              filterAccessors={BILLING_CAMPAIGN_QUEUE_FILTER_ACCESSORS}
            >
              <BillingCampaignQueueTable
                campaigns={dashboard.campaign_queue}
                settingsSlot={
                  <OperationalTableControlsSlot contextLabel="Billing queue" />
                }
              />
            </OperationalTableSuiteProvider>
          </OperationalWorkspaceTabPanel>
        </TabsContent>

        <TabsContent value="overview" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel className="space-y-4 p-4 md:p-5">
            <OperationalTableSuiteProvider
              tableId={OPERATIONAL_TABLE_IDS.billingCollectionTracker}
              columns={collectionTrackerColumns}
              rows={openInvoices}
              filterAccessors={BILLING_COLLECTION_TRACKER_FILTER_ACCESSORS}
            >
              <CollectionTracker
                invoices={dashboard.invoices}
                settingsSlot={
                  <OperationalTableControlsSlot contextLabel="Collection tracker" />
                }
              />
            </OperationalTableSuiteProvider>
            <OperationalTableSuiteProvider
              tableId={OPERATIONAL_TABLE_IDS.billingFinancialApprovals}
              columns={financialApprovalsColumns}
              rows={dashboard.pending_approvals}
              filterAccessors={BILLING_FINANCIAL_APPROVALS_FILTER_ACCESSORS}
            >
              <BillingApprovalsPanel
                approvals={dashboard.pending_approvals}
                settingsSlot={
                  <OperationalTableControlsSlot contextLabel="Financial approvals" />
                }
              />
            </OperationalTableSuiteProvider>
          </OperationalWorkspaceTabPanel>
        </TabsContent>

        <TabsContent value="invoices" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel>
            <OperationalTableSuiteProvider
              tableId={OPERATIONAL_TABLE_IDS.billingInvoicesList}
              columns={BILLING_INVOICES_TABLE_COLUMNS}
              rows={dashboard.invoices}
              filterAccessors={BILLING_INVOICES_FILTER_ACCESSORS}
            >
              <BillingTabTableShell
                title="Invoices"
                description={`${dashboard.invoices.length} issued invoice${dashboard.invoices.length === 1 ? "" : "s"}`}
                settingsLabel="Invoices"
              >
                <BillingInvoicesTable invoices={dashboard.invoices} />
              </BillingTabTableShell>
            </OperationalTableSuiteProvider>
          </OperationalWorkspaceTabPanel>
        </TabsContent>

        <TabsContent value="collections" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel>
            <OperationalTableSuiteProvider
              tableId={OPERATIONAL_TABLE_IDS.billingCollectionTracker}
              columns={collectionTrackerColumns}
              rows={openInvoices}
              filterAccessors={BILLING_COLLECTION_TRACKER_FILTER_ACCESSORS}
            >
              <CollectionTracker
                invoices={dashboard.invoices}
                settingsSlot={
                  <OperationalTableControlsSlot contextLabel="Collection tracker" />
                }
              />
            </OperationalTableSuiteProvider>
          </OperationalWorkspaceTabPanel>
        </TabsContent>

        <TabsContent value="aging" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel className="p-4 md:p-5">
            <AgingReport aging={dashboard.aging} mixedCurrency={mixedCurrency} />
          </OperationalWorkspaceTabPanel>
        </TabsContent>

        <TabsContent value="approvals" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel>
            <OperationalTableSuiteProvider
              tableId={OPERATIONAL_TABLE_IDS.billingFinancialApprovals}
              columns={financialApprovalsColumns}
              rows={dashboard.pending_approvals}
              filterAccessors={BILLING_FINANCIAL_APPROVALS_FILTER_ACCESSORS}
            >
              <BillingApprovalsPanel
                approvals={dashboard.pending_approvals}
                settingsSlot={
                  <OperationalTableControlsSlot contextLabel="Financial approvals" />
                }
              />
            </OperationalTableSuiteProvider>
          </OperationalWorkspaceTabPanel>
        </TabsContent>

        <TabsContent value="vendors" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel>
            <OperationalTableSuiteProvider
              tableId={OPERATIONAL_TABLE_IDS.billingVendorPaymentBatches}
              columns={BILLING_VENDOR_BATCHES_TABLE_COLUMNS}
              rows={dashboard.vendor_batches}
              filterAccessors={BILLING_VENDOR_BATCHES_FILTER_ACCESSORS}
            >
              <VendorBatchesCard
                batches={dashboard.vendor_batches}
                settingsSlot={
                  <OperationalTableControlsSlot contextLabel="Vendor payment batches" />
                }
              />
            </OperationalTableSuiteProvider>
          </OperationalWorkspaceTabPanel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
