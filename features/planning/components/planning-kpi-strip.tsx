"use client";

import { BarChart3Icon } from "lucide-react";

import { KpiCarousel } from "@/components/ui/kpi-carousel";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlanningKpiCard } from "@/lib/planning/queries/load-planning-dashboard";
import type { AnalyticsCurrencyContext } from "@/lib/analytics/types/metrics";

type PlanningKpiStripProps = {
  cards: PlanningKpiCard[];
  currency: AnalyticsCurrencyContext;
  loading?: boolean;
};

export function PlanningKpiStrip({ cards, currency, loading }: PlanningKpiStripProps) {
  if (loading) {
    return (
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="flex min-w-[168px] shrink-0 flex-col gap-2 rounded-xl border border-border/70 bg-card p-3 shadow-sm"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
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
    accentClass:
      card.variant === "positive"
        ? "bg-emerald-500/10 text-emerald-700"
        : card.variant === "negative"
          ? "bg-red-500/10 text-red-600"
          : "bg-brand-purple/10 text-brand-purple",
    valueAlert:
      card.variant === "negative"
        ? ("danger" as const)
        : card.variant === "positive"
          ? undefined
          : undefined,
  }));

  return (
    <div className="space-y-2">
      {currency.is_mixed_currency ? (
        <p className="text-[11px] text-muted-foreground">
          {currency.mixed_label ?? "Mixed currency"} — totals are not FX-converted.
        </p>
      ) : null}
      <KpiCarousel items={items} showNavigation={false} />
    </div>
  );
}
