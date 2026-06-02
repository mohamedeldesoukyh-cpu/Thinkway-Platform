"use client";

import { memo, useCallback, useMemo } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

import { DeliverableBillingStatusBadge } from "@/features/billing/components/deliverable-billing-status-badge";
import { BillingStatusBadge } from "@/features/billing/components/billing-status-badge";
import { OperationalSelectionCheckbox } from "@/features/billing/components/operational-selection-checkbox";
import { formatBillingMoney } from "@/features/billing/utils";
import {
  isOperationalRowActionEligible,
  isOperationalRowInvoiceEligible,
  type OperationalBillingRow,
} from "@/lib/billing/operational-billing-rows";
import {
  getRowSelectionStatus,
  type OperationalSelectionState,
} from "@/lib/billing/operational-selection";

export type OperationalRowTreeProps = {
  row: OperationalBillingRow;
  depth: number;
  currency: string;
  rootRows: OperationalBillingRow[];
  selection: OperationalSelectionState;
  isOpen: boolean;
  onToggleExpand: (id: string) => void;
  onToggleSelect: (row: OperationalBillingRow) => void;
  /** Child row ids that are expanded — only passed to children that need it. */
  expandedIds: ReadonlySet<string>;
};

export const OperationalRowTree = memo(function OperationalRowTree({
  row,
  depth,
  currency,
  rootRows,
  selection,
  isOpen,
  onToggleExpand,
  onToggleSelect,
  expandedIds,
}: OperationalRowTreeProps) {
  const hasChildren = row.children.length > 0;
  const selectionStatus = useMemo(
    () => getRowSelectionStatus(row, selection),
    [row, selection]
  );
  const eligible =
    isOperationalRowActionEligible(row) || isOperationalRowInvoiceEligible(row);
  const indent = depth * 16;

  const handleExpand = useCallback(() => {
    onToggleExpand(row.id);
  }, [onToggleExpand, row.id]);

  const handleSelect = useCallback(() => {
    onToggleSelect(row);
  }, [onToggleSelect, row]);

  return (
    <>
      <div
        className="flex items-center gap-2 rounded-2xl px-2 py-1.5 hover:bg-muted/40"
        style={{ paddingLeft: indent + 8 }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="rounded p-0.5 hover:bg-muted"
            onClick={handleExpand}
            aria-expanded={isOpen}
          >
            {isOpen ? (
              <ChevronDownIcon className="size-3.5" />
            ) : (
              <ChevronRightIcon className="size-3.5" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <OperationalSelectionCheckbox
          status={selectionStatus}
          disabled={!eligible && selectionStatus === "unchecked"}
          onToggle={handleSelect}
          ariaLabel={`Select ${row.label}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{row.label}</p>
            {row.document_number ? (
              <span className="font-mono text-[10px] text-muted-foreground">
                {row.document_number}
              </span>
            ) : null}
            {row.kind === "assignment" ? (
              <BillingStatusBadge status={row.line_billing_status} />
            ) : (
              <DeliverableBillingStatusBadge
                status={
                  row.billing_status as import("@/features/billing/types").AssignmentDeliverableBillingStatus
                }
              />
            )}
            {row.is_locked ? (
              <span className="text-[10px] text-muted-foreground">Locked</span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatBillingMoney(row.remaining_amount, currency)} remaining ·{" "}
            {formatBillingMoney(row.invoiced_amount, currency)} invoiced
            {row.invoice_document_number ? ` · ${row.invoice_document_number}` : ""}
          </p>
        </div>
      </div>
      {isOpen
        ? row.children.map((child) => (
            <OperationalRowTree
              key={child.id}
              row={child}
              depth={depth + 1}
              currency={currency}
              rootRows={rootRows}
              selection={selection}
              isOpen={expandedIds.has(child.id)}
              onToggleExpand={onToggleExpand}
              onToggleSelect={onToggleSelect}
              expandedIds={expandedIds}
            />
          ))
        : null}
    </>
  );
});
