"use client";

import { AlertTriangleIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatMoney, formatPercent } from "@/features/campaigns/utils";
import type { CommercialSummary } from "@/lib/assignments/commercial-calculations";
import { cn } from "@/lib/utils";

type AssignmentStickyFooterProps = {
  currency: string;
  summary: CommercialSummary;
  revenueVatAmount: number;
  costVatAmount: number;
  poExceeded?: boolean;
  className?: string;
};

export function AssignmentStickyFooter({
  currency,
  summary,
  revenueVatAmount,
  costVatAmount,
  poExceeded,
  className,
}: AssignmentStickyFooterProps) {
  return (
    <div
      className={cn(
        "sticky bottom-0 -mx-6 border-t bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        className
      )}
    >
      {poExceeded ? (
        <div className="mb-2 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangleIcon className="size-3.5" />
          PO exceeded — warning only; you can still save this assignment
        </div>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-sm">
          <Stat label="Deliverables" value={String(summary.deliverable_units)} />
          <Stat
            label="Creator cost (ex-VAT)"
            value={formatMoney(summary.total_cost_before_vat, currency)}
          />
          <Stat
            label="Revenue (ex-VAT)"
            value={formatMoney(summary.total_revenue_before_vat, currency)}
          />
          <Stat label="GP (ex-VAT)" value={formatMoney(summary.gp, currency)} highlight />
          <Stat label="Margin" value={formatPercent(summary.margin_percent)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">VAT out: {formatMoney(revenueVatAmount, currency)}</Badge>
          <Badge variant="outline">VAT in: {formatMoney(costVatAmount, currency)}</Badge>
        </div>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Operational GP and margin are ex-VAT. Ctrl+Enter to save · Ctrl+S to save form
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("font-semibold", highlight && "text-primary")}>{value}</p>
    </div>
  );
}
