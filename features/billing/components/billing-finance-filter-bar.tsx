"use client";

import { cn } from "@/lib/utils";
import type { CampaignBillingQueueFilter } from "@/lib/billing/campaign-billing-queue";

export const BILLING_FINANCE_FILTER_OPTIONS: {
  value: CampaignBillingQueueFilter;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "invoiced", label: "Invoiced" },
  { value: "not_invoiced", label: "Not invoiced" },
  { value: "partially_invoiced", label: "Partially invoiced" },
  { value: "fully_achieved", label: "Fully achieved" },
  { value: "partially_achieved", label: "Partially achieved" },
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "moved_to_billing", label: "Moved to billing" },
];

type BillingFinanceFilterBarProps = {
  value: CampaignBillingQueueFilter;
  onChange: (value: CampaignBillingQueueFilter) => void;
  className?: string;
};

export function BillingFinanceFilterBar({
  value,
  onChange,
  className,
}: BillingFinanceFilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-1.5 rounded-2xl border border-border/60 bg-muted/30 p-1.5",
        className
      )}
      role="group"
      aria-label="Finance filters"
    >
      {BILLING_FINANCE_FILTER_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              onChange(opt.value);
              if (process.env.NODE_ENV === "development") {
                console.debug("[billing-filter] finance filter selected", {
                  filter: opt.value,
                });
              }
            }}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "border-border bg-background text-foreground shadow-sm"
                : "border-transparent bg-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground"
            )}
            aria-pressed={active}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
