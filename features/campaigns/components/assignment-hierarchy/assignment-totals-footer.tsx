"use client";

import { FileTextIcon } from "lucide-react";

import {
  OperationalFloatingActionBar,
  PlatformFloatingBarDivider,
  PlatformFloatingBarPrimaryButton,
  PlatformFloatingBarSelection,
} from "@/components/workspace/operational-floating-action-bar";
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
      <PlatformFloatingBarSelection
        selectedCount={selectedCount}
        selectionLabel="line"
        onClearSelection={() => {}}
        showClearButton={false}
      />

      <PlatformFloatingBarDivider />

      <span className="shrink-0 px-2 text-xs text-muted-foreground">
        Invoice{" "}
        <span className="font-semibold text-foreground">
          {formatMoney(selectedTotal, currency)}
        </span>
      </span>

      <PlatformFloatingBarDivider className="ml-auto" />

      <div className="pl-2">
        <PlatformFloatingBarPrimaryButton
          action={{
            id: "invoice",
            label: "Create invoice",
            icon: FileTextIcon,
            onClick: onCreateInvoice,
          }}
        />
      </div>
    </OperationalFloatingActionBar>
  );
}
