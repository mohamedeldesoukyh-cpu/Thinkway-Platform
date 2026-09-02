"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";

import "@/app/styles/billing-workspace-v3.css";

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
  BILLING_VENDOR_ASSIGNMENTS_FILTER_ACCESSORS,
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
  BillingInvoicesTable,
} from "@/features/billing/components/billing-invoices-table";
import { BillingCardHeader } from "@/features/billing/components/billing-card-header";
import { BillingKpiStrip } from "@/features/billing/components/billing-kpi-strip";
import { BillingOverviewPanel } from "@/features/billing/components/billing-overview-panel";
import {
  BILLING_VENDOR_ASSIGNMENTS_COLUMN_METAS,
  BillingVendorPaymentsPanel,
} from "@/features/billing/components/billing-vendor-payments-panel";
import {
  BILLING_COLLECTION_TRACKER_COLUMN_METAS,
  BILLING_COLLECTION_TRACKER_TABLE_COLUMNS,
  CollectionTracker,
} from "@/features/billing/components/collection-tracker";
import type { BillingDashboard } from "@/features/billing/types";

type BillingWorkspaceViewProps = {
  dashboard: BillingDashboard;
};

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
    <OperationalTableSection
      wide
      tableOnly
      cardSurface
      leading={
        <BillingCardHeader
          title={title}
          subtitle={description}
          actions={<OperationalTableControlsSlot contextLabel={settingsLabel} />}
        />
      }
    >
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
  const remainingToInvoice = useMemo(
    () => dashboard.campaign_queue.reduce((sum, row) => sum + row.remaining_to_invoice, 0),
    [dashboard.campaign_queue]
  );
  const billedCampaignCount = useMemo(
    () => dashboard.campaign_queue.filter((row) => row.already_invoiced > 0).length,
    [dashboard.campaign_queue]
  );
  const collectedCount = useMemo(
    () => dashboard.invoices.filter((invoice) => invoice.collection_status === "collected").length,
    [dashboard.invoices]
  );
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
  const vendorAssignmentColumns = useMemo(
    () =>
      operationalColumnsFromMetas(
        BILLING_VENDOR_ASSIGNMENTS_COLUMN_METAS,
        BILLING_VENDOR_ASSIGNMENTS_FILTER_ACCESSORS
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
      collections: {
        value: "collections",
        label: "Collections",
        count: openInvoices.length,
      },
      aging: { value: "aging", label: "Aging" },
      approvals: {
        value: "approvals",
        label: "Approvals",
        count: dashboard.pending_approvals.length,
      },
      vendors: {
        value: "vendors",
        label: "Vendor payments",
        count: dashboard.vendor_assignments.length,
      },
    }),
    [
      dashboard.campaign_queue.length,
      dashboard.invoices.length,
      dashboard.pending_approvals.length,
      dashboard.vendor_assignments.length,
      openInvoices.length,
    ]
  );

  return (
    <div className="tw-billing-v3 space-y-4">
      <BillingKpiStrip
        kpis={dashboard.kpis}
        currency={kpiCurrency}
        mixedCurrency={mixedCurrency}
        campaignCount={dashboard.campaign_queue.length}
        billedCampaignCount={billedCampaignCount}
        remainingToInvoice={remainingToInvoice}
      />

      <Tabs defaultValue="queue" className="flex flex-col gap-0">
        <OperationalWorkspaceSortableTabsBar
          tabOrder={tabOrder}
          tabsById={tabsById}
          onReorder={moveTab}
          variant="underline"
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
          <OperationalWorkspaceTabPanel className="p-0 md:p-0">
            <BillingOverviewPanel campaigns={dashboard.campaign_queue} />
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
                description={`${dashboard.invoices.length} issued · ${collectedCount} collected, ${dashboard.invoices.length - collectedCount} open`}
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
          <OperationalWorkspaceTabPanel>
            <AgingReport
              aging={dashboard.aging}
              invoices={dashboard.invoices}
              currency={kpiCurrency}
              mixedCurrency={mixedCurrency}
            />
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
              tableId={OPERATIONAL_TABLE_IDS.billingVendorAssignments}
              columns={vendorAssignmentColumns}
              rows={dashboard.vendor_assignments}
              filterAccessors={BILLING_VENDOR_ASSIGNMENTS_FILTER_ACCESSORS}
            >
              <BillingVendorPaymentsPanel
                assignments={dashboard.vendor_assignments}
                settingsSlot={
                  <OperationalTableControlsSlot contextLabel="Vendor payments" />
                }
              />
            </OperationalTableSuiteProvider>
          </OperationalWorkspaceTabPanel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
