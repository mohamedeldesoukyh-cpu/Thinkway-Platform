"use client";

import { FinanceSuiteKpiStrip, type FinanceSuiteKpiTone } from "@/components/finance/suite";
import type { CollectionsKpiCard } from "@/lib/collections/queries/load-collections-dashboard";
import type { AnalyticsCurrencyContext } from "@/lib/analytics/types/metrics";

type CollectionsKpiStripProps = {
  cards: CollectionsKpiCard[];
  currency: AnalyticsCurrencyContext;
};

export function CollectionsKpiStrip({
  cards,
  currency,
}: CollectionsKpiStripProps) {
  const items = cards.map((card) => {
    const tone: FinanceSuiteKpiTone | undefined =
      card.variant === "negative"
        ? "bad"
        : card.variant === "warning"
          ? "warn"
          : card.variant === "positive"
            ? "ok"
            : undefined;
    const trend =
      card.trend_percent != null
        ? `${card.trend_percent > 0 ? "+" : ""}${card.trend_percent.toFixed(1)}%`
        : undefined;
    return {
      id: card.id,
      label: card.label,
      value: card.formatted,
      hint: trend,
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
