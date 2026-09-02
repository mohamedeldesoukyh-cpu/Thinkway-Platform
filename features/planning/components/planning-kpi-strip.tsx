"use client";

import { FinanceSuiteEmpty, FinanceSuiteKpiStrip, type FinanceSuiteKpiTone } from "@/components/finance/suite";
import type { PlanningKpiCard } from "@/lib/planning/queries/load-planning-dashboard";
import type { AnalyticsCurrencyContext } from "@/lib/analytics/types/metrics";

type PlanningKpiStripProps = {
  cards: PlanningKpiCard[];
  currency: AnalyticsCurrencyContext;
  loading?: boolean;
};

export function PlanningKpiStrip({ cards, currency, loading }: PlanningKpiStripProps) {
  if (!loading && cards.length === 0) {
    return (
      <FinanceSuiteEmpty
        title="No budget version selected"
        body="Create or approve a budget version to see KPIs, trends and the dimensional drill-down. Every panel below depends on it."
      />
    );
  }

  const items = cards.map((card) => {
    const tone: FinanceSuiteKpiTone | undefined =
      card.variant === "negative" ? "bad" : card.variant === "positive" ? "ok" : undefined;
    return {
      id: card.id,
      label: card.label,
      value: card.formatted,
      tone,
    };
  });

  return (
    <div className="space-y-2">
      <FinanceSuiteKpiStrip items={items} />
      {currency.is_mixed_currency ? (
        <p className="text-[11px] text-muted-foreground">
          {currency.mixed_label ?? "Mixed currency"} — totals are not FX-converted.
        </p>
      ) : null}
    </div>
  );
}
