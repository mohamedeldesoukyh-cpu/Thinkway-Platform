"use client";

import { memo, useCallback, useMemo, useState, type ChangeEvent, type FocusEvent } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

import { DeliverableBillingStatusBadge } from "@/features/billing/components/deliverable-billing-status-badge";
import { BillingStatusBadge } from "@/features/billing/components/billing-status-badge";
import { OperationalSelectionCheckbox } from "@/features/billing/components/operational-selection-checkbox";
import { DocumentNumber } from "@/components/ui/document-number";
import { Input } from "@/components/ui/input";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import { formatBillingMoney } from "@/features/billing/utils";
import {
  CampaignOperationalTableCell,
  CampaignOperationalTableCellAmount,
  CampaignOperationalTableRow,
} from "@/features/campaigns/components/campaign-operational-table";
import type { CampaignLineOperationalStatus } from "@/features/campaigns/types/operational";
import {
  isOperationalRowUiSelectable,
  type OperationalBillingRow,
} from "@/lib/billing/operational-billing-rows";
import {
  computeInvoiceDraftLine,
  type InvoiceDraftLine,
  type InvoiceDraftPercents,
} from "@/lib/billing/operational-invoice-draft";
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
  percents: InvoiceDraftPercents;
  onPercentChange: (rowId: string, percent: number) => void;
  onToBeInvoicedChange: (rowId: string, amount: number) => void;
  /** Match campaign workspace assignment table typography */
  appearance?: "default" | "campaign";
  /**
   * Invoice table shows assignment lines only.
   * Deliverable/post children stay in the draft engine for cascade + create.
   */
  showNestedRows?: boolean;
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

export function resolveAssignmentBillingStatus(
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

function formatDraftPercent(percent: number): string {
  if (!Number.isFinite(percent)) return "0";
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(2);
}

export function DraftNumericInput({
  value,
  ariaLabel,
  disabled,
  min,
  max,
  widthClass,
  onCommit,
}: {
  value: number;
  ariaLabel: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  widthClass: string;
  onCommit: (next: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const display = text ?? (Number.isFinite(value) ? String(value) : "0");

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setText(event.target.value);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    const next = Number(event.target.value);
    setText(null);
    onCommit(Number.isFinite(next) ? next : 0);
  }

  return (
    <Input
      type="number"
      min={min}
      max={max}
      step={0.01}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "h-7 rounded-md px-1.5 text-right text-[11px] tabular-nums",
        widthClass
      )}
      value={display}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}

export function OperationalInvoiceDraftCells({
  draft,
  currency,
  editable,
  percentAriaLabel,
  amountAriaLabel,
  onPercentChange,
  onToBeInvoicedChange,
}: {
  draft: InvoiceDraftLine;
  currency: string;
  editable: boolean;
  percentAriaLabel: string;
  amountAriaLabel: string;
  onPercentChange: (percent: number) => void;
  onToBeInvoicedChange: (amount: number) => void;
}) {
  return (
    <>
      <CampaignOperationalTableCellAmount>
        {formatBillingMoney(draft.amount, currency)}
      </CampaignOperationalTableCellAmount>
      <CampaignOperationalTableCell className="w-[5.5rem] text-right">
        <div className="flex items-center justify-end gap-0.5">
          <DraftNumericInput
            value={Number(formatDraftPercent(draft.percent))}
            ariaLabel={percentAriaLabel}
            disabled={!editable}
            min={0}
            max={100}
            widthClass="w-14"
            onCommit={onPercentChange}
          />
          <span className="text-[11px] text-muted-foreground">%</span>
        </div>
      </CampaignOperationalTableCell>
      <CampaignOperationalTableCellAmount>
        {editable ? (
          <DraftNumericInput
            value={draft.toBeInvoiced}
            ariaLabel={amountAriaLabel}
            min={0}
            widthClass="w-[6.5rem]"
            onCommit={onToBeInvoicedChange}
          />
        ) : (
          formatBillingMoney(draft.toBeInvoiced, currency)
        )}
      </CampaignOperationalTableCellAmount>
      <CampaignOperationalTableCellAmount>
        {formatBillingMoney(draft.vatAmount, currency)}
      </CampaignOperationalTableCellAmount>
      <CampaignOperationalTableCellAmount>
        {formatBillingMoney(draft.totalInvoice, currency)}
      </CampaignOperationalTableCellAmount>
      <CampaignOperationalTableCellAmount>
        {formatBillingMoney(draft.remaining, currency)}
      </CampaignOperationalTableCellAmount>
    </>
  );
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
  percents,
  onPercentChange,
  onToBeInvoicedChange,
  appearance = "default",
  showNestedRows = false,
}: OperationalRowTreeProps) {
  const campaign = appearance === "campaign";
  traceChildrenAccess("OperationalRowTree:hasChildren", row, "length");
  const hasChildren = showNestedRows && row.children.length > 0;
  const selectionStatus = useMemo(
    () => getRowSelectionStatus(row, selection),
    [row, selection]
  );
  const selectable =
    isOperationalRowUiSelectable(row) ||
    getSelectableDescendantRows(row).length > 0;
  const muted = isRowMuted(row);
  const indent = depth * 16;
  const draft = useMemo(() => computeInvoiceDraftLine(row, percents), [row, percents]);
  const editable = !muted && draft.amount > 0.01;

  const handleExpand = useCallback(() => {
    onToggleExpand(row.id);
  }, [onToggleExpand, row.id]);

  const handleSelect = useCallback(() => {
    onToggleSelect(row);
  }, [onToggleSelect, row]);

  return (
    <>
      <CampaignOperationalTableRow
        className={cn(muted && "opacity-50")}
        data-depth={depth}
      >
        {showNestedRows ? (
          <CampaignOperationalTableCell className="w-8 pr-0">
            {hasChildren ? (
              <button
                type="button"
                className="rounded p-0.5 hover:bg-muted"
                onClick={handleExpand}
                aria-expanded={isOpen}
                aria-label={isOpen ? `Collapse ${row.label}` : `Expand ${row.label}`}
              >
                {isOpen ? (
                  <ChevronDownIcon className="size-3.5" />
                ) : (
                  <ChevronRightIcon className="size-3.5" />
                )}
              </button>
            ) : null}
          </CampaignOperationalTableCell>
        ) : null}
        <CampaignOperationalTableCell className="w-10 pr-0">
          <OperationalSelectionCheckbox
            status={selectionStatus}
            disabled={!selectable}
            onToggle={handleSelect}
            ariaLabel={`Select ${row.label}`}
          />
        </CampaignOperationalTableCell>
        <CampaignOperationalTableCell>
          <div className="min-w-0" style={{ paddingLeft: indent }}>
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
            {row.invoice_document_number ? (
              <p className={cn("text-muted-foreground", campaign ? "text-[11px]" : "text-xs")}>
                {formatDocumentNumberForDisplay(row.invoice_document_number)}
              </p>
            ) : null}
          </div>
        </CampaignOperationalTableCell>
        <OperationalInvoiceDraftCells
          draft={draft}
          currency={currency}
          editable={editable}
          percentAriaLabel={`Invoice percent for ${row.label}`}
          amountAriaLabel={`To be invoiced for ${row.label}`}
          onPercentChange={(percent) => onPercentChange(row.id, percent)}
          onToBeInvoicedChange={(amount) => onToBeInvoicedChange(row.id, amount)}
        />
      </CampaignOperationalTableRow>
      {showNestedRows && isOpen
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
              percents={percents}
              onPercentChange={onPercentChange}
              onToBeInvoicedChange={onToBeInvoicedChange}
              onToggleExpand={onToggleExpand}
              onToggleSelect={onToggleSelect}
              appearance={appearance}
              showNestedRows={showNestedRows}
            />
          ))
        : null}
    </>
  );
});
