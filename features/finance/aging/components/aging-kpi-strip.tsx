"use client";

import { AGING_BUCKET_LABELS, bucketSeverity } from "@/lib/collections/aging";
import type { AgingSummary } from "@/lib/collections/aging";
import { formatBillingMoney } from "@/features/billing/utils";
import { formatKpiCurrency, resolveAgingBucketHealth } from "@/components/shared/kpi/kpi-utils";
import { MetricCard } from "@/components/shared/kpi/metric-card";

type AgingKpiStripProps = {
  summary: AgingSummary;
  mixedCurrency: boolean;
  primaryCurrency?: string;
  basisLabel: string;
};

export function AgingKpiStrip({
  summary,
  mixedCurrency,
  primaryCurrency,
  basisLabel,
}: AgingKpiStripProps) {
  const formatAmount = (amount: number) =>
    mixedCurrency || !primaryCurrency
      ? formatKpiCurrency(amount, null, { mixed: true })
      : formatBillingMoney(amount, primaryCurrency);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Aging basis: {basisLabel}
        {mixedCurrency ? " · Mixed currencies — bucket totals are not converted." : null}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {summary.buckets.map((bucket) => {
          const severity = bucketSeverity(bucket.bucket);
          const pct =
            summary.total_outstanding > 0
              ? Math.round((bucket.amount / summary.total_outstanding) * 100)
              : 0;
          return (
            <MetricCard
              key={bucket.bucket}
              layout="aging"
              title={AGING_BUCKET_LABELS[bucket.bucket]}
              value={formatAmount(bucket.amount)}
              subtitle={`${bucket.count} invoice${bucket.count === 1 ? "" : "s"} · ${pct}%`}
              health={resolveAgingBucketHealth(severity)}
            />
          );
        })}
      </div>
    </div>
  );
}
