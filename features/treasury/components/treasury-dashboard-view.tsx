"use client";

import Link from "next/link";

import { TreasuryTrendChart } from "@/components/collections/charts/treasury-trend-chart";
import {
  FinanceSuiteDeck,
  FinanceSuiteTile,
} from "@/components/finance/suite";
import { Button } from "@/components/ui/button";
import type { TreasuryDashboardPayload } from "@/lib/treasury/load-treasury-dashboard";
import { devLog } from "@/lib/platform/logger";

type TreasuryDashboardViewProps = {
  data: TreasuryDashboardPayload;
};

function sparkFrom(points: { value: number }[]): { spark: number[]; hi: number } | undefined {
  if (points.length === 0) return undefined;
  const max = Math.max(...points.map((p) => Math.abs(p.value)), 1);
  const spark = points.slice(-8).map((p) => Math.round((Math.abs(p.value) / max) * 100));
  const hi = spark.reduce((best, value, index, arr) => (value >= arr[best] ? index : best), 0);
  return { spark, hi };
}

export function TreasuryDashboardView({ data }: TreasuryDashboardViewProps) {
  if (process.env.NODE_ENV === "development") {
    devLog("[treasury] render dashboard");
  }

  const kpi = (id: string) => data.kpis.find((item) => item.id === id);
  const cashIn = kpi("cash_in");
  const cashOut = kpi("cash_out");
  const net = kpi("net");
  const ar = kpi("ar");
  const ap = kpi("ap");
  const vendor = kpi("vendor_exposure");

  const cashflowSpark = sparkFrom(data.charts.cashflow_trend);
  const collectionsSpark = sparkFrom(data.charts.collections_trend);
  const payoutSpark = sparkFrom(data.charts.payout_trend);
  const liquiditySpark = sparkFrom(data.charts.liquidity_forecast);

  const emptyHint = data.currency.is_mixed_currency
    ? data.currency.mixed_label ?? "Mixed currency — totals are not FX-converted."
    : undefined;

  return (
    <div className="space-y-4">
      <div className="thinkway-campaign-section-card">
        <div className="thinkway-campaign-section-head">
          <div className="min-w-0">
            <h2>Treasury position</h2>
            <p>Visibility from A/R, A/P, invoices and planning rollups</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/collections">Open collections</Link>
          </Button>
        </div>
        <div className="fs-pad">
          <FinanceSuiteDeck>
            <FinanceSuiteTile
              kicker="Receivable"
              big={ar?.formatted ?? "—"}
              title="Owed to Thinkway"
              description={emptyHint ?? "Outstanding client invoices."}
              href="/collections"
              go="Open collections"
              spark={collectionsSpark?.spark}
              sparkHi={collectionsSpark?.hi}
            />
            <FinanceSuiteTile
              kicker="Payable"
              big={ap?.formatted ?? vendor?.formatted ?? "—"}
              title="Owed to vendors"
              description="Vendor IO exposure that is not marked paid."
              href="/ios/vendor"
              go="Open vendor IOs"
              variant="alt"
              spark={payoutSpark?.spark}
              sparkHi={payoutSpark?.hi}
            />
            <FinanceSuiteTile
              kicker="Net position"
              big={net?.formatted ?? "—"}
              title="Receivable less payable"
              description="Before any bank cash balance is known."
              href="/treasury"
              go="Breakdown"
              variant="alt"
            />
            <FinanceSuiteTile
              kicker="Expected cash in"
              big={cashIn?.formatted ?? "—"}
              title="Collections forecast"
              description="From open invoices and planning rollups."
              href="/collections"
              go="Open collections"
              spark={collectionsSpark?.spark}
              sparkHi={collectionsSpark?.hi}
            />
            <FinanceSuiteTile
              kicker="Cashflow trend"
              title={cashflowSpark ? "Weekly net" : "No dated payments yet"}
              description={
                cashflowSpark
                  ? "Expected in less expected out."
                  : "Needs dated payments in and out."
              }
              variant={cashflowSpark ? "default" : "soft"}
              href="/treasury"
              go={cashflowSpark ? "View chart" : "What is missing"}
              spark={cashflowSpark?.spark}
              sparkHi={cashflowSpark?.hi}
            />
            <FinanceSuiteTile
              kicker="Payout trend"
              title={payoutSpark ? "Expected out" : "No settled vendor dates"}
              description={
                payoutSpark ? cashOut?.formatted : "Needs a settled date per vendor IO."
              }
              variant={payoutSpark ? "alt" : "soft"}
              href="/ios/vendor"
              go={payoutSpark ? "Open vendor IOs" : "What is missing"}
              spark={payoutSpark?.spark}
              sparkHi={payoutSpark?.hi}
            />
            <FinanceSuiteTile
              kicker="Liquidity forecast"
              title={liquiditySpark ? "Monthly net" : "No data for selected filters"}
              description={
                liquiditySpark
                  ? "Planning collections vs payouts."
                  : "Needs due dates on both sides of the ledger."
              }
              variant="soft"
              href="/planning"
              go={liquiditySpark ? "Open planning" : "What is missing"}
              spark={liquiditySpark?.spark}
              sparkHi={liquiditySpark?.hi}
            />
            <FinanceSuiteTile
              kicker="Cash position"
              big="—"
              title="Bank balances"
              description="No bank account is connected, so opening cash is unknown."
              variant="soft"
              href="/treasury"
              go="Connect bank"
            />
          </FinanceSuiteDeck>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TreasuryTrendChart
          title="Cashflow trend"
          data={data.charts.cashflow_trend}
          logTag="treasury"
        />
        <TreasuryTrendChart
          title="Collections trend"
          data={data.charts.collections_trend}
          strokeClassName="stroke-emerald-500"
          logTag="treasury"
        />
        <TreasuryTrendChart
          title="Payout trend"
          data={data.charts.payout_trend}
          strokeClassName="stroke-amber-500"
          logTag="treasury"
        />
        <TreasuryTrendChart
          title="Liquidity forecast"
          data={data.charts.liquidity_forecast}
          strokeClassName="stroke-violet-500"
          logTag="cashflow-forecast"
        />
      </div>
    </div>
  );
}
