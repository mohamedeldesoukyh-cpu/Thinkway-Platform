"use client";

import Link from "next/link";

import { TreasuryTrendChart } from "@/components/collections/charts/treasury-trend-chart";
import { Button } from "@/components/ui/button";
import { AgingSection } from "@/features/collections/components/aging-section";
import { ClientStatementView } from "@/features/collections/components/client-statement-view";
import { CollectionsAlertsPanel } from "@/features/collections/components/collections-alerts-panel";
import { CollectionsFilterBar } from "@/features/collections/components/collections-filter-bar";
import { CollectionsKpiStrip } from "@/features/collections/components/collections-kpi-strip";
import { InvoicesArTable } from "@/features/collections/components/invoices-ar-table";
import { PaymentAllocationSection } from "@/features/collections/components/payment-allocation-section";
import { VendorPayablesSection } from "@/features/collections/components/vendor-payables-section";
import type { CollectionsWorkspacePayload } from "@/features/collections/load-workspace";
import { devLog } from "@/lib/platform/logger";

type CollectionsWorkspaceViewProps = {
  data: CollectionsWorkspacePayload;
};

export function CollectionsWorkspaceView({ data }: CollectionsWorkspaceViewProps) {
  const tab = data.filterState.tab ?? "dashboard";
  const { dashboard } = data;

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
        <section className="space-y-3">
          <h3 className="font-heading text-lg font-semibold">Overdue management</h3>
          <InvoicesArTable
            invoices={dashboard.aged_invoices}
            currency={dashboard.currency}
            filter="overdue"
          />
        </section>
      ) : null}

      {tab === "payables" ? (
        <VendorPayablesSection payables={data.payables} />
      ) : null}
    </div>
  );
}
