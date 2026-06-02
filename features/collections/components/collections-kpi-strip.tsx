"use client";

import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
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
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
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

  return (
    <div className="space-y-2">
      {currency.is_mixed_currency ? (
        <p className="text-xs text-muted-foreground">
          {currency.mixed_label ?? "Mixed currency"} — totals are not FX-converted.
        </p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {cards.map((card) => {
          const trend =
            card.variant === "positive"
              ? "up"
              : card.variant === "negative"
                ? "down"
                : "flat";
          return (
            <Card
              key={card.id}
              className={cn(
                "shadow-sm",
                card.variant === "negative" && "border-red-500/30",
                card.variant === "warning" && "border-amber-500/30"
              )}
            >
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p
                  className={cn(
                    "font-heading text-lg font-semibold",
                    card.variant === "positive" && "text-emerald-600",
                    card.variant === "negative" && "text-red-600"
                  )}
                >
                  {card.formatted}
                </p>
                {card.trend_percent != null ? (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                    {trend === "up" ? (
                      <ArrowUpIcon className="size-3" />
                    ) : trend === "down" ? (
                      <ArrowDownIcon className="size-3" />
                    ) : (
                      <MinusIcon className="size-3" />
                    )}
                    {Math.abs(card.trend_percent).toFixed(1)}%
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
