"use client";

import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnalyticsKpiCard, AnalyticsKpiStrip } from "@/lib/analytics/types/outputs";
import { cn } from "@/lib/utils";

type ExecutiveKpiStripProps = {
  strip: AnalyticsKpiStrip;
  loading?: boolean;
};

function trendForCard(card: AnalyticsKpiCard): "up" | "down" | "flat" {
  if (card.trend_percent == null) return "flat";
  if (card.trend_percent > 0) return "up";
  if (card.trend_percent < 0) return "down";
  return "flat";
}

/** Subtle brand accent colors cycled across the KPI strip (operational, low-opacity). */
const KPI_ACCENTS = [
  "var(--brand-blue)",
  "var(--brand-purple)",
  "var(--brand-pink)",
  "var(--success)",
] as const;

function KpiCard({
  card,
  mixedCurrency,
  index,
}: {
  card: AnalyticsKpiCard;
  mixedCurrency: boolean;
  index: number;
}) {
  const trend = trendForCard(card);
  const isPercent = card.id === "margin";
  const isCount = card.id === "active_campaigns";
  const hasAlert = card.alert === "danger" || card.alert === "warning";
  const accent = KPI_ACCENTS[index % KPI_ACCENTS.length];

  return (
    <Card
      className={cn(
        "relative shadow-sm transition-colors",
        card.alert === "danger" && "border-destructive/40 bg-destructive/5",
        card.alert === "warning" && "border-amber-500/40 bg-amber-500/5"
      )}
    >
      {!hasAlert ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-5 -right-5 size-16 rounded-full opacity-[0.07]"
          style={{ backgroundColor: accent }}
        />
      ) : null}
      <CardContent className="relative p-3">
        <p className="text-xs text-muted-foreground">{card.label}</p>
        <p className="font-heading text-lg font-semibold tracking-tight">
          {isPercent
            ? `${card.value.toFixed(1)}%`
            : isCount
              ? String(Math.round(card.value))
              : card.formatted_value}
        </p>
        {mixedCurrency && !isPercent && !isCount ? (
          <p className="mt-0.5 text-[10px] text-muted-foreground">Mixed currencies</p>
        ) : null}
        {card.trend_percent != null ? (
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
            <span>{Math.abs(card.trend_percent).toFixed(1)}%</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ExecutiveKpiStrip({ strip, loading }: ExecutiveKpiStripProps) {
  if (loading) {
    return (
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Card key={i} className="shadow-sm">
            <CardContent className="p-3 space-y-2">
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
      {strip.currency.is_mixed_currency ? (
        <p className="text-xs text-muted-foreground">
          {strip.currency.mixed_label ?? "Mixed currency"} — totals are not FX-converted.
        </p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {strip.cards.map((card, index) => (
          <KpiCard
            key={card.id}
            card={card}
            index={index}
            mixedCurrency={strip.currency.is_mixed_currency}
          />
        ))}
      </div>
    </div>
  );
}
