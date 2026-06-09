"use client";

import Link from "next/link";

import { TreasuryTrendChart } from "@/components/collections/charts/treasury-trend-chart";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { Button } from "@/components/ui/button";
import { AgingSection } from "@/features/collections/components/aging-section";
import { ClientStatementView } from "@/features/collections/components/client-statement-view";
import { CollectionsAlertsPanel } from "@/features/collections/components/collections-alerts-panel";
import { CollectionsFilterBar } from "@/features/collections/components/collections-filter-bar";
import { CollectionsKpiStrip } from "@/features/collections/components/collections-kpi-strip";
import {
  INVOICES_AR_TABLE_COLUMN_METAS,
  InvoicesArTable,
} from "@/features/collections/components/invoices-ar-table";
import { PaymentAllocationSection } from "@/features/collections/components/payment-allocation-section";
import {
  VENDOR_PAYABLES_TABLE_COLUMN_METAS,
  VendorPayablesSection,
} from "@/features/collections/components/vendor-payables-section";
import type { CollectionsWorkspacePayload } from "@/features/collections/load-workspace";
import { devLog } from "@/lib/platform/logger";
import { operationalColumnsFromMetas } from "@/lib/tables/operational-filter-columns";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import {
  INVOICES_AR_FILTER_ACCESSORS,
  VENDOR_PAYABLES_FILTER_ACCESSORS,
} from "@/lib/tables/workspace-table-filter-fields";

type CollectionsWorkspaceViewProps = {
  data: CollectionsWorkspacePayload;
};

const OVERDUE_AR_COLUMNS = operationalColumnsFromMetas(
  INVOICES_AR_TABLE_COLUMN_METAS,
  INVOICES_AR_FILTER_ACCESSORS
);
const VENDOR_PAYABLES_SUITE_COLUMNS = operationalColumnsFromMetas(
  VENDOR_PAYABLES_TABLE_COLUMN_METAS,
  VENDOR_PAYABLES_FILTER_ACCESSORS
);

export function CollectionsWorkspaceView({ data }: CollectionsWorkspaceViewProps) {
  const tab = data.filterState.tab ?? "dashboard";
  const { dashboard } = data;
  const overdueRows = dashboard.aged_invoices.filter(
    (invoice) => invoice.aging_bucket !== "current" && invoice.outstanding > 0
  );
  const payablesRows = data.payables?.rows ?? [];

  if (process.env.NODE_ENV === "development") {
    devLog("[collections] render", tab);
  }

  return (
    <div className="space-y-6">
      <CollectionsFilterBar options={data.filterOptions} />

      {data.queryWarnings.length > 0 ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          {data.queryWarnings.join(" · ")}
        </div>
      ) : null}

      {tab === "dashboard" ? (
        <section className="space-y-6">
          <CollectionsKpiStrip cards={dashboard.kpis} currency={dashboard.currency} />
          <CollectionsAlertsPanel alerts={dashboard.alerts} />
          <AgingSection
            aging={dashboard.aging}
            currency={dashboard.currency}
            clientAging={dashboard.client_aging}
          />
          <Button variant="outline" size="sm" asChild>
            <Link href="/treasury">Open treasury dashboard</Link>
          </Button>
        </section>
      ) : null}

      {tab === "aging" ? (
        <AgingSection
          aging={dashboard.aging}
          currency={dashboard.currency}
          clientAging={dashboard.client_aging}
        />
      ) : null}

      {tab === "statements" ? (
        <ClientStatementView statement={data.statement} />
      ) : null}

      {tab === "allocation" ? (
        <PaymentAllocationSection
          invoices={dashboard.aged_invoices}
          currency={dashboard.currency}
        />
      ) : null}

      {tab === "forecast" && data.treasury ? (
        <section className="space-y-4">
          <h3 className="font-heading text-lg font-semibold">Collections & cashflow forecast</h3>
          <p className="text-sm text-muted-foreground">
            Expected collections from open AR due dates and planning snapshots (no AI prediction).
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <TreasuryTrendChart
              title="Expected collections (weekly)"
              data={data.treasury.charts.collections_trend}
              strokeClassName="stroke-emerald-500"
              logTag="cashflow-forecast"
            />
            <TreasuryTrendChart
              title="Liquidity forecast (monthly)"
              data={data.treasury.charts.liquidity_forecast}
              strokeClassName="stroke-violet-500"
              logTag="cashflow-forecast"
            />
          </div>
        </section>
      ) : null}

      {tab === "overdue" ? (
        <OperationalTableSuiteProvider
          tableId={OPERATIONAL_TABLE_IDS.collectionsArOverdue}
          columns={OVERDUE_AR_COLUMNS}
          rows={overdueRows}
          filterAccessors={INVOICES_AR_FILTER_ACCESSORS}
        >
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-heading text-lg font-semibold">Overdue management</h3>
              <OperationalTableControlsSlot contextLabel="Overdue AR" />
            </div>
            <InvoicesArTable
              invoices={dashboard.aged_invoices}
              currency={dashboard.currency}
              filter="overdue"
            />
          </section>
        </OperationalTableSuiteProvider>
      ) : null}

      {tab === "payables" ? (
        <OperationalTableSuiteProvider
          tableId={OPERATIONAL_TABLE_IDS.collectionsVendorPayables}
          columns={VENDOR_PAYABLES_SUITE_COLUMNS}
          rows={payablesRows}
          filterAccessors={VENDOR_PAYABLES_FILTER_ACCESSORS}
        >
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-heading text-lg font-semibold">Vendor payables</h3>
              <OperationalTableControlsSlot contextLabel="Vendor payables" />
            </div>
            <VendorPayablesSection payables={data.payables} />
          </section>
        </OperationalTableSuiteProvider>
      ) : null}
    </div>
  );
}
