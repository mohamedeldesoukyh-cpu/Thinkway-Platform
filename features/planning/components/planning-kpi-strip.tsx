"use client";

import { BarChart3Icon } from "lucide-react";

import { resolveKpiVariantAccent, resolveKpiVariantHealth } from "@/components/shared/kpi/kpi-utils";
import { KpiStrip } from "@/components/shared/kpi/kpi-strip";
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
      <p className="text-[11px] text-muted-foreground">
        No budget version selected. Create or approve a budget to see KPIs.
      </p>
    );
  }

  const items = cards.map((card) => ({
    id: card.id,
    label: card.label,
    value: card.formatted,
    icon: BarChart3Icon,
    accentClass: resolveKpiVariantAccent(card.variant),
    health: card.variant === "negative" ? resolveKpiVariantHealth("negative") : undefined,
  }));

  return (
    <KpiStrip
      items={items}
      showNavigation={false}
      loading={loading}
      mixedCurrencyNotice={
        currency.is_mixed_currency
          ? `${currency.mixed_label ?? "Mixed currency"} — totals are not FX-converted.`
          : undefined
      }
    />
  );
}
