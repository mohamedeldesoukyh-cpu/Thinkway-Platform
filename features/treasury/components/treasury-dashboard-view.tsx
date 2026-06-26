"use client";

import Link from "next/link";

import { TreasuryTrendChart } from "@/components/collections/charts/treasury-trend-chart";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/shared/kpi/metric-card";
import type { TreasuryDashboardPayload } from "@/lib/treasury/load-treasury-dashboard";
import { devLog } from "@/lib/platform/logger";

type TreasuryDashboardViewProps = {
  data: TreasuryDashboardPayload;
};

export function TreasuryDashboardView({ data }: TreasuryDashboardViewProps) {
  if (process.env.NODE_ENV === "development") {
    devLog("[treasury] render dashboard");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Treasury visibility from AR, AP, invoices, and planning rollups.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/collections">Collections workspace</Link>
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {data.kpis.map((kpi) => (
          <MetricCard
            key={kpi.id}
            layout="card"
            title={kpi.label}
            value={kpi.formatted}
          />
        ))}
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
