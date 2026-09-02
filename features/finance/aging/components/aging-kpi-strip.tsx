"use client";

import { AGING_BUCKET_LABELS, bucketSeverity } from "@/lib/collections/aging";
import type { AgingSummary } from "@/lib/collections/aging";
import { formatBillingMoney } from "@/features/billing/utils";
import { formatKpiCurrency, resolveAgingBucketHealth } from "@/components/shared/kpi/kpi-utils";
import { FinanceSuiteKpiStrip, type FinanceSuiteKpiTone } from "@/components/finance/suite";

type AgingKpiStripProps = {
  summary: AgingSummary;
  mixedCurrency: boolean;
  primaryCurrency?: string;
  basisLabel: string;
};

function toneFromHealth(
  health: ReturnType<typeof resolveAgingBucketHealth>
): FinanceSuiteKpiTone | undefined {
  if (health === "destructive") return "bad";
  if (health === "warning") return "warn";
  if (health === "success") return "ok";
  return undefined;
}

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
      <FinanceSuiteKpiStrip
        items={summary.buckets.map((bucket) => {
          const severity = bucketSeverity(bucket.bucket);
          const pct =
            summary.total_outstanding > 0
              ? Math.round((bucket.amount / summary.total_outstanding) * 100)
              : 0;
          return {
            id: bucket.bucket,
            label: AGING_BUCKET_LABELS[bucket.bucket],
            value: formatAmount(bucket.amount),
            hint: `${bucket.count} invoice${bucket.count === 1 ? "" : "s"} · ${pct}%`,
            tone: toneFromHealth(resolveAgingBucketHealth(severity)),
          };
        })}
      />
    </div>
  );
}
