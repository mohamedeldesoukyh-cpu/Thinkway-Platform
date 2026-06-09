"use client";

import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import type { BillingDashboard } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";
import { cn } from "@/lib/utils";

type AgingReportProps = {
  aging: BillingDashboard["aging"];
  currency?: string;
  mixedCurrency?: boolean;
};

const BUCKET_COLORS = [
  "bg-emerald-500/15 border-emerald-500/30",
  "bg-amber-500/15 border-amber-500/30",
  "bg-orange-500/15 border-orange-500/30",
  "bg-red-500/15 border-red-500/30",
  "bg-destructive/15 border-destructive/30",
];

export function AgingReport({ aging, currency, mixedCurrency = false }: AgingReportProps) {
  const totalOutstanding = aging.reduce((s, b) => s + b.amount, 0);
  const formatAmount = (amount: number) =>
    mixedCurrency || !currency
      ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)
      : formatBillingMoney(amount, currency);

  return (
    <CampaignFlatSection
      title="A/R aging"
      description={`Outstanding balance by days past due · ${formatAmount(totalOutstanding)} total`}
    >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {aging.map((bucket, index) => {
            const pct =
              totalOutstanding > 0
                ? Math.round((bucket.amount / totalOutstanding) * 100)
                : 0;
            return (
              <div
                key={bucket.bucket}
                className={cn(
                  "rounded-3xl border p-4",
                  BUCKET_COLORS[index] ?? BUCKET_COLORS[0]
                )}
              >
                <p className="text-xs font-medium text-muted-foreground">
                  {bucket.label}
                </p>
                <p className="font-heading mt-1 text-xl font-semibold">
                  {formatAmount(bucket.amount)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {bucket.count} invoice{bucket.count === 1 ? "" : "s"} · {pct}%
                </p>
              </div>
            );
          })}
        </div>
    </CampaignFlatSection>
  );
}
