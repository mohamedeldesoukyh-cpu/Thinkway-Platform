"use client";

import { AGING_BUCKET_LABELS, bucketSeverity } from "@/lib/collections/aging";
import type { AgingSummary } from "@/lib/collections/aging";
import { formatBillingMoney } from "@/features/billing/utils";
import { cn } from "@/lib/utils";

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
      ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)
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
            <div
              key={bucket.bucket}
              className={cn(
                "rounded-2xl border p-4",
                severity === "danger" && "border-red-500/40 bg-red-500/5",
                severity === "warn" && "border-amber-500/40 bg-amber-500/5",
                severity === "ok" && "border-border"
              )}
            >
              <p className="text-xs text-muted-foreground">
                {AGING_BUCKET_LABELS[bucket.bucket]}
              </p>
              <p className="text-lg font-semibold">{formatAmount(bucket.amount)}</p>
              <p className="text-xs text-muted-foreground">
                {bucket.count} invoice{bucket.count === 1 ? "" : "s"} · {pct}%
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
