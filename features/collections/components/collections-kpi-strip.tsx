"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  BarChart3Icon,
  MinusIcon,
} from "lucide-react";

import {
  resolveKpiVariantAccent,
  resolveKpiVariantHealth,
  kpiTrendChipClassName,
} from "@/components/shared/kpi/kpi-utils";
import { KpiStrip } from "@/components/shared/kpi/kpi-strip";
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
  const items = cards.map((card) => ({
    id: card.id,
    label: card.label,
    value: card.formatted,
    icon: BarChart3Icon,
    accentClass: resolveKpiVariantAccent(card.variant),
    health: resolveKpiVariantHealth(card.variant),
  }));

  const trendFooter =
    cards.some((c) => c.trend_percent != null) ? (
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
              <span key={`trend-${card.id}`} className={kpiTrendChipClassName()}>
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
    ) : null;

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
      footer={trendFooter}
    />
  );
}
