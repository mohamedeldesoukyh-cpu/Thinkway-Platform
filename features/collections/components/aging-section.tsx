"use client";

import { AGING_BUCKET_LABELS, bucketSeverity, type AgingSummary } from "@/lib/collections/aging";
import { formatAnalyticsAmount } from "@/lib/analytics/currency/engine";
import type { AnalyticsCurrencyContext } from "@/lib/analytics/types/metrics";
import { cn } from "@/lib/utils";

type AgingSectionProps = {
  aging: AgingSummary;
  currency: AnalyticsCurrencyContext;
  clientAging: { key: string; label: string; summary: AgingSummary }[];
};

export function AgingSection({ aging, currency, clientAging }: AgingSectionProps) {
  const format = (n: number) => formatAnalyticsAmount(n, currency, { decimals: 0 });

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {aging.buckets.map((bucket) => {
          const severity = bucketSeverity(bucket.bucket);
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
              <p className="text-lg font-semibold">{format(bucket.amount)}</p>
              <p className="text-xs text-muted-foreground">{bucket.count} invoices</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border">
        <p className="border-b border-border px-4 py-2 text-sm font-medium">Client aging</p>
        <div className="divide-y divide-border">
          {clientAging.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No open AR by client.</p>
          ) : (
            clientAging.map((row) => (
              <div
                key={row.key}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <span className="font-medium">{row.label}</span>
                <span className="font-mono text-xs">
                  {format(row.summary.total_outstanding)} · overdue{" "}
                  {format(row.summary.overdue_amount)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
