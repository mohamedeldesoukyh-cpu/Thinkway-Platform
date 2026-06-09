"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  BarChart3Icon,
  MinusIcon,
} from "lucide-react";

import { KpiCarousel } from "@/components/ui/kpi-carousel";
import { Skeleton } from "@/components/ui/skeleton";
import type { CollectionsKpiCard } from "@/lib/collections/queries/load-collections-dashboard";
import type { AnalyticsCurrencyContext } from "@/lib/analytics/types/metrics";
import { cn } from "@/lib/utils";

type CollectionsKpiStripProps = {
  cards: CollectionsKpiCard[];
  currency: AnalyticsCurrencyContext;
  loading?: boolean;
};

export function CollectionsKpiStrip({
  cards,
  currency,
  loading,
}: CollectionsKpiStripProps) {
  if (loading) {
    return (
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
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

  const items = cards.map((card) => ({
    id: card.id,
    label: card.label,
    value: card.formatted,
    icon: BarChart3Icon,
    accentClass:
      card.variant === "negative"
        ? "bg-red-500/10 text-red-600"
        : card.variant === "warning"
          ? "bg-amber-500/10 text-amber-700"
          : card.variant === "positive"
            ? "bg-emerald-500/10 text-emerald-700"
            : "bg-brand-blue/10 text-brand-blue",
    valueAlert:
      card.variant === "negative"
        ? ("danger" as const)
        : card.variant === "warning"
          ? ("warning" as const)
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
      {cards.some((c) => c.trend_percent != null) ? (
        <div className="flex flex-wrap gap-2 px-1">
          {cards
            .filter((c) => c.trend_percent != null)
            .map((card) => {
              const trend =
                card.variant === "positive"
                  ? "up"
                  : card.variant === "negative"
                    ? "down"
                    : "flat";
              return (
                <span
                  key={`trend-${card.id}`}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground"
                  )}
                >
                  {trend === "up" ? (
                    <ArrowUpIcon className="size-3" />
                  ) : trend === "down" ? (
                    <ArrowDownIcon className="size-3" />
                  ) : (
                    <MinusIcon className="size-3" />
                  )}
                  {card.label}: {Math.abs(card.trend_percent ?? 0).toFixed(1)}%
                </span>
              );
            })}
        </div>
      ) : null}
    </div>
  );
}
