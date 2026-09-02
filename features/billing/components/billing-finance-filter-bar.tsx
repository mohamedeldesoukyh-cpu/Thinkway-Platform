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
  counts?: Partial<Record<CampaignBillingQueueFilter, number>>;
  className?: string;
};

export function BillingFinanceFilterBar({
  value,
  onChange,
  counts,
  className,
}: BillingFinanceFilterBarProps) {
  return (
    <div className={cn("bq-chips", className)} role="group" aria-label="Finance filters">
      {BILLING_FINANCE_FILTER_OPTIONS.map((opt) => {
        const active = value === opt.value;
        const count = counts?.[opt.value];
        const empty = typeof count === "number" && count === 0 && opt.value !== "all";
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
            className={cn(empty && "z")}
            aria-pressed={active}
          >
            {opt.label}
            {typeof count === "number" ? <b>{count}</b> : null}
          </button>
        );
      })}
    </div>
  );
}
