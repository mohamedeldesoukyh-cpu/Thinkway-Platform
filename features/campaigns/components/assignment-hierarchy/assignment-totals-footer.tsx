"use client";

import { FileTextIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/features/campaigns/utils";
import { cn } from "@/lib/utils";

type AssignmentTotalsFooterProps = {
  selectedCount: number;
  selectedTotal: number;
  currency: string;
  onCreateInvoice: () => void;
  className?: string;
};

export function AssignmentTotalsFooter({
  selectedCount,
  selectedTotal,
  currency,
  onCreateInvoice,
  className,
}: AssignmentTotalsFooterProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        "sticky bottom-2 flex flex-wrap items-center justify-between gap-3",
        "rounded-xl border bg-background/95 px-3 py-2.5 text-sm shadow-sm backdrop-blur",
        className
      )}
    >
      <div>
        <span className="font-medium">{selectedCount}</span> deliverable
        {selectedCount === 1 ? "" : "s"} selected · Invoice{" "}
        <span className="font-semibold">{formatMoney(selectedTotal, currency)}</span>
      </div>
      <Button type="button" size="sm" onClick={onCreateInvoice}>
        <FileTextIcon data-icon="inline-start" />
        Create invoice
      </Button>
    </div>
  );
}
