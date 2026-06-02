"use client";

import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlanningKpiCard } from "@/lib/planning/queries/load-planning-dashboard";
import type { AnalyticsCurrencyContext } from "@/lib/analytics/types/metrics";
import { cn } from "@/lib/utils";

type PlanningKpiStripProps = {
  cards: PlanningKpiCard[];
  currency: AnalyticsCurrencyContext;
  loading?: boolean;
};

function KpiCard({
  card,
  mixedCurrency,
}: {
  card: PlanningKpiCard;
  mixedCurrency: boolean;
}) {
  const trend =
    card.variant === "positive" ? "up" : card.variant === "negative" ? "down" : "flat";

  return (
    <Card className="shadow-sm">
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{card.label}</p>
        <p
          className={cn(
            "font-heading text-lg font-semibold tracking-tight",
            card.variant === "positive" && "text-emerald-600 dark:text-emerald-400",
            card.variant === "negative" && "text-red-600 dark:text-red-400"
          )}
        >
          {card.isPercent ? card.formatted : card.formatted}
        </p>
        {mixedCurrency && !card.isPercent ? (
          <p className="mt-0.5 text-[10px] text-muted-foreground">Mixed currencies</p>
        ) : null}
        {card.variant ? (
          <div
            className={cn(
              "mt-1 flex items-center gap-1 text-[10px] font-medium",
              trend === "up" && "text-emerald-600 dark:text-emerald-400",
              trend === "down" && "text-red-600 dark:text-red-400",
              trend === "flat" && "text-muted-foreground"
            )}
          >
            {trend === "up" ? (
              <ArrowUpIcon className="size-3" aria-hidden />
            ) : trend === "down" ? (
              <ArrowDownIcon className="size-3" aria-hidden />
            ) : (
              <MinusIcon className="size-3" aria-hidden />
            )}
            <span>{card.label.includes("%") ? "vs budget" : "variance"}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function PlanningKpiStrip({ cards, currency, loading }: PlanningKpiStripProps) {
  if (loading) {
    return (
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 9 }).map((_, i) => (
          <Card key={i} className="shadow-sm">
            <CardContent className="space-y-2 p-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No budget version selected. Create or approve a budget to see KPIs.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {currency.is_mixed_currency ? (
        <p className="text-xs text-muted-foreground">
          {currency.mixed_label ?? "Mixed currency"} — totals are not FX-converted.
        </p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => (
          <KpiCard key={card.id} card={card} mixedCurrency={currency.is_mixed_currency} />
        ))}
      </div>
    </div>
  );
}
