"use client";

import { memo, useCallback, useMemo } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

import { DeliverableBillingStatusBadge } from "@/features/billing/components/deliverable-billing-status-badge";
import { BillingStatusBadge } from "@/features/billing/components/billing-status-badge";
import { OperationalSelectionCheckbox } from "@/features/billing/components/operational-selection-checkbox";
import { DocumentNumber } from "@/components/ui/document-number";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import { formatBillingMoney } from "@/features/billing/utils";
import type { CampaignLineOperationalStatus } from "@/features/campaigns/types/operational";
import {
  isOperationalRowUiSelectable,
  type OperationalBillingRow,
} from "@/lib/billing/operational-billing-rows";
import {
  getRowSelectionStatus,
  getSelectableDescendantRows,
  type OperationalSelectionState,
} from "@/lib/billing/operational-selection";
import { traceChildrenAccess } from "@/lib/billing/operational-billing-trace";
import { cn } from "@/lib/utils";

export type OperationalRowTreeProps = {
  row: OperationalBillingRow;
  depth: number;
  currency: string;
  rootRows: OperationalBillingRow[];
  selection: OperationalSelectionState;
  isOpen: boolean;
  onToggleExpand: (id: string) => void;
  onToggleSelect: (row: OperationalBillingRow) => void;
  expandedIds: ReadonlySet<string>;
  /** Match campaign workspace assignment table typography */
  appearance?: "default" | "campaign";
};

function isRowMuted(row: OperationalBillingRow): boolean {
  const operational = (row.operational_status ?? "draft") as CampaignLineOperationalStatus;
  if (operational === "invoiced") return true;
  if (["invoiced", "paid", "closed", "partially_paid"].includes(row.line_billing_status)) {
    return true;
  }
  if (row.is_locked) return true;
  if (["invoiced", "collected"].includes(row.billing_status)) return true;
  return false;
}

function resolveAssignmentBillingStatus(
  row: OperationalBillingRow
): import("@/features/billing/types").CampaignLineBillingStatus {
  if (
    row.vendor_io_id &&
    !row.invoice_id &&
    (row.line_billing_status === "draft" || row.line_billing_status === "approved")
  ) {
    return "moved_to_billing";
  }
  return row.line_billing_status;
}

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
  appearance = "default",
}: OperationalRowTreeProps) {
  const campaign = appearance === "campaign";
  traceChildrenAccess("OperationalRowTree:hasChildren", row, "length");
  const hasChildren = row.children.length > 0;
  const selectionStatus = useMemo(
    () => getRowSelectionStatus(row, selection),
    [row, selection]
  );
  const selectable =
    isOperationalRowUiSelectable(row) ||
    getSelectableDescendantRows(row).length > 0;
  const muted = isRowMuted(row);
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
        className={cn(
          "flex items-center gap-2 px-2 hover:bg-muted/40",
          campaign ? "rounded-none py-1.5 hover:bg-muted/15" : "rounded-2xl py-1.5",
          muted && "opacity-50"
        )}
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
          disabled={!selectable}
          onToggle={handleSelect}
          ariaLabel={`Select ${row.label}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={cn(
                campaign ? "text-[11px] font-normal" : "text-sm font-medium",
                muted && "text-muted-foreground"
              )}
            >
              {row.label}
            </p>
            {row.document_number ? (
              <DocumentNumber
                value={row.document_number}
                className={cn(
                  "text-muted-foreground",
                  campaign ? "text-[11px]" : "text-[10px]"
                )}
              />
            ) : null}
            {row.kind === "assignment" ? (
              <BillingStatusBadge status={resolveAssignmentBillingStatus(row)} />
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
          <p className={cn("text-muted-foreground", campaign ? "text-[11px] font-normal" : "text-xs")}>
            {formatBillingMoney(row.remaining_amount, currency)} remaining ·{" "}
            {formatBillingMoney(row.invoiced_amount, currency)} invoiced
            {row.invoice_document_number
              ? ` · ${formatDocumentNumberForDisplay(row.invoice_document_number)}`
              : ""}
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
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onToggleSelect={onToggleSelect}
              appearance={appearance}
            />
          ))
        : null}
    </>
  );
});
