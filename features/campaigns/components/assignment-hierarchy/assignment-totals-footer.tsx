"use client";

import { FileTextIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OperationalFloatingActionBar } from "@/components/workspace/operational-floating-action-bar";
import { formatMoney } from "@/features/campaigns/utils";

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
  const visible = selectedCount > 0;

  return (
    <OperationalFloatingActionBar visible={visible} className={className}>
      <Badge
        variant="secondary"
        className="h-6 shrink-0 rounded-full px-2.5 text-[11px] font-semibold"
      >
        {selectedCount} selected
      </Badge>
      <span className="shrink-0 text-xs text-muted-foreground">
        Invoice{" "}
        <span className="font-semibold text-foreground">
          {formatMoney(selectedTotal, currency)}
        </span>
      </span>
      <Button
        type="button"
        size="sm"
        className="ml-auto h-8 shrink-0 rounded-full text-xs"
        onClick={onCreateInvoice}
      >
        <FileTextIcon data-icon="inline-start" />
        Create invoice
      </Button>
    </OperationalFloatingActionBar>
  );
}
