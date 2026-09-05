import type { ReactNode } from "react";

import type { ExecutiveDashboardPayload } from "@/features/analytics/load-executive-dashboard";
import type { HomeDashboardSnapshot } from "@/features/home/queries";
import { formatMoneyKpi } from "@/lib/finance/currency-format";

export type HomeDashboardConflict = {
  id: string;
  body: ReactNode;
};

function kpiValue(
  data: ExecutiveDashboardPayload,
  id: string
): number | null {
  const card = data.executive_kpis.cards.find((item) => item.id === id);
  return card ? card.value : null;
}

function formatPlain(amount: number): string {
  return amount.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function ratioLabel(larger: number, smaller: number): string {
  if (smaller <= 0) return "—";
  return `${(larger / smaller).toFixed(1)}×`;
}

function gapLabel(a: number, b: number): string {
  const gap = Math.abs(a - b);
  if (b <= 0) return formatPlain(gap);
  const multiple = a / b;
  if (multiple >= 1.5 || multiple <= 0.67) {
    return `${multiple.toFixed(1)}×`;
  }
  return formatPlain(gap);
}

export function collectHomeConflicts(input: {
  snapshot: HomeDashboardSnapshot;
  executive: ExecutiveDashboardPayload | null;
}): HomeDashboardConflict[] {
  const { snapshot, executive } = input;
  if (!executive) return [];

  const conflicts: HomeDashboardConflict[] = [];
  const currency = executive.executive_kpis.currency;
  const collected = kpiValue(executive, "collected") ?? 0;
  const invoiced = kpiValue(executive, "invoiced") ?? 0;
  const dashRevenue = kpiValue(executive, "revenue") ?? 0;
  const outstanding = kpiValue(executive, "outstanding") ?? 0;
  const agingTotal = executive.collections.aging.reduce(
    (sum, row) => sum + row.amount,
    0
  );

  if (collected > invoiced * 1.05 && invoiced > 0) {
    conflicts.push({
      id: "collected-gt-invoiced",
      body: (
        <>
          Collected <b>{formatPlain(collected)}</b> exceeds Total invoiced{" "}
          <b>{formatPlain(invoiced)}</b> by{" "}
          <b>{gapLabel(collected, invoiced)}</b>. Collections cannot exceed
          billing unless the two measure different scopes or periods.
        </>
      ),
    });
  }

  if (
    dashRevenue > 0 &&
    snapshot.total_revenue > 0 &&
    (snapshot.total_revenue / dashRevenue >= 1.2 ||
      dashRevenue / snapshot.total_revenue >= 1.2)
  ) {
    conflicts.push({
      id: "home-vs-dash-revenue",
      body: (
        <>
          This page shows Revenue{" "}
          <b>{formatMoneyKpi(snapshot.total_revenue, snapshot.currency_code)}</b>
          ; the dashboard shows <b>{formatPlain(dashRevenue)}</b> for the same
          book — a <b>{gapLabel(snapshot.total_revenue, dashRevenue)}</b> gap
          under one label.
        </>
      ),
    });
  }

  if (currency.is_mixed_currency && currency.currencies.length > 1) {
    conflicts.push({
      id: "mixed-fx",
      body: (
        <>
          Dashboard totals mix <b>{currency.currencies.join(", ")}</b> with{" "}
          <b>no FX conversion</b>.
        </>
      ),
    });
  }

  if (
    outstanding > 0 &&
    agingTotal > 0 &&
    Math.abs(outstanding - agingTotal) > outstanding * 0.15
  ) {
    const missing = Math.round(outstanding - agingTotal);
    conflicts.push({
      id: "outstanding-vs-aging",
      body: (
        <>
          Outstanding is <b>{formatPlain(outstanding)}</b> but ageing totals{" "}
          <b>{formatPlain(agingTotal)}</b>
          {missing > 0 ? (
            <>
              {" "}
              — <b>{formatPlain(missing)}</b> is missing from the ageing.
            </>
          ) : (
            "."
          )}
        </>
      ),
    });
  }

  return conflicts;
}

export function collectExecutiveConflicts(
  data: ExecutiveDashboardPayload
): HomeDashboardConflict[] {
  const conflicts: HomeDashboardConflict[] = [];
  const currency = data.executive_kpis.currency;
  const collected = kpiValue(data, "collected") ?? 0;
  const invoiced = kpiValue(data, "invoiced") ?? 0;
  const outstanding = kpiValue(data, "outstanding") ?? 0;
  const overdue = data.collections.aging
    .filter((row) => row.bucket === "61_90" || row.bucket === "90_plus")
    .reduce((sum, row) => sum + row.amount, 0);

  if (currency.is_mixed_currency && currency.currencies.length > 1) {
    conflicts.push({
      id: "mix-totals",
      body: (
        <>
          Totals marked <b>MIX</b> add <b>{currency.currencies.join(", ")}</b>{" "}
          with <b>no FX conversion</b> — valid as a count of activity,
          meaningless as an amount of money.
        </>
      ),
    });
  }

  if (collected > invoiced * 1.05 && invoiced > 0) {
    conflicts.push({
      id: "collected-gt-invoiced",
      body: (
        <>
          Collected <b>{formatPlain(collected)}</b> is{" "}
          <b>{ratioLabel(collected, invoiced)}</b> Total invoiced{" "}
          <b>{formatPlain(invoiced)}</b>. Collections cannot exceed billing; the
          two measure different scopes or periods.
        </>
      ),
    });
  }

  if (outstanding > 0 && overdue > 0 && outstanding - overdue > outstanding * 0.15) {
    conflicts.push({
      id: "outstanding-vs-overdue",
      body: (
        <>
          Outstanding is <b>{formatPlain(outstanding)}</b> but only{" "}
          <b>{formatPlain(overdue)}</b> appears as an overdue invoice —{" "}
          <b>{formatPlain(Math.round(outstanding - overdue))}</b> is missing
          from the ageing.
        </>
      ),
    });
  }

  return conflicts;
}

export function overdueFromExecutive(
  data: ExecutiveDashboardPayload | null
): { amount: number; count: number } {
  if (!data) return { amount: 0, count: 0 };
  return data.collections.aging
    .filter((row) => row.bucket === "61_90" || row.bucket === "90_plus")
    .reduce(
      (acc, row) => ({
        amount: acc.amount + row.amount,
        count: acc.count + row.count,
      }),
      { amount: 0, count: 0 }
    );
}
