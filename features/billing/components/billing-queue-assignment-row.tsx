"use client";

import { memo, useCallback, useMemo, type ReactNode } from "react";

import { BillingStatusBadge } from "@/features/billing/components/billing-status-badge";
import { OperationalSelectionCheckbox } from "@/features/billing/components/operational-selection-checkbox";
import {
  DraftNumericInput,
  resolveAssignmentBillingStatus,
} from "@/features/billing/components/operational-row-tree";
import { useBillingQueueColumnVisibility } from "@/features/billing/components/use-billing-queue-column-visibility";
import { useOperationalVisibleColumnCount } from "@/components/tables/operational-table-column-context";
import {
  CampaignOperationalTableCell,
  CampaignOperationalTableCellAmount,
  CampaignOperationalTableCellMono,
  CampaignOperationalTableRow,
} from "@/features/campaigns/components/campaign-operational-table";
import { formatBillingMoney } from "@/features/billing/utils";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
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
import { cn } from "@/lib/utils";

export function BillingQueueMessageRow({ children }: { children: ReactNode }) {
  const count = useOperationalVisibleColumnCount();
  return (
    <CampaignOperationalTableRow className="bq-krow">
      <CampaignOperationalTableCell colSpan={count} className="text-[11px] text-muted-foreground">
        {children}
      </CampaignOperationalTableCell>
    </CampaignOperationalTableRow>
  );
}

function isAssignmentMuted(row: OperationalBillingRow): boolean {
  if (row.operational_status === "invoiced") return true;
  if (["invoiced", "paid", "closed", "partially_paid"].includes(row.line_billing_status)) {
    return true;
  }
  if (row.is_locked) return true;
  if (["invoiced", "collected"].includes(row.billing_status)) return true;
  return false;
}

function formatDraftPercent(percent: number): string {
  if (!Number.isFinite(percent)) return "0";
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(2);
}

function amountClass(amount: number, positive = false) {
  if (!(amount > 0.01)) return "bq-v-z";
  return positive ? "bq-v-pos" : undefined;
}

export function BillingQueueAssignmentHeaderRow() {
  const cols = useBillingQueueColumnVisibility();
  const lineSpan =
    Number(cols.showClient) + Number(cols.showBrand) + Number(cols.showCampaign);

  return (
    <CampaignOperationalTableRow className="bq-khd">
      {cols.showExpand ? <CampaignOperationalTableCell /> : null}
      {cols.showSelect ? <CampaignOperationalTableCell /> : null}
      {cols.showCampaignNo ? (
        <CampaignOperationalTableCell>Line ref</CampaignOperationalTableCell>
      ) : null}
      {lineSpan > 0 ? (
        <CampaignOperationalTableCell colSpan={lineSpan}>Line</CampaignOperationalTableCell>
      ) : null}
      {cols.showCurrency ? <CampaignOperationalTableCell /> : null}
      {cols.showTotal ? (
        <CampaignOperationalTableCell className="text-right">Achieved</CampaignOperationalTableCell>
      ) : null}
      {cols.showAchieved ? (
        <CampaignOperationalTableCell className="text-right">Invoice %</CampaignOperationalTableCell>
      ) : null}
      {cols.showInvoiced ? (
        <CampaignOperationalTableCell className="text-right">
          Bill amount
        </CampaignOperationalTableCell>
      ) : null}
      {cols.showRemaining ? (
        <CampaignOperationalTableCell className="text-right">VAT</CampaignOperationalTableCell>
      ) : null}
      {cols.showUnachieved ? (
        <CampaignOperationalTableCell className="text-right">Line total</CampaignOperationalTableCell>
      ) : null}
      {cols.showStatus ? <CampaignOperationalTableCell>State</CampaignOperationalTableCell> : null}
      {cols.showActions ? (
        <CampaignOperationalTableCell className="text-right">Invoice</CampaignOperationalTableCell>
      ) : null}
    </CampaignOperationalTableRow>
  );
}

type BillingQueueAssignmentRowProps = {
  row: OperationalBillingRow;
  currency: string;
  selection: OperationalSelectionState;
  percents: InvoiceDraftPercents;
  onPercentChange: (rowId: string, percent: number) => void;
  onToBeInvoicedChange: (rowId: string, amount: number) => void;
  onToggleSelect: (row: OperationalBillingRow) => void;
};

export const BillingQueueAssignmentRow = memo(function BillingQueueAssignmentRow({
  row,
  currency,
  selection,
  percents,
  onPercentChange,
  onToBeInvoicedChange,
  onToggleSelect,
}: BillingQueueAssignmentRowProps) {
  const cols = useBillingQueueColumnVisibility();
  const lineSpan =
    Number(cols.showClient) + Number(cols.showBrand) + Number(cols.showCampaign);
  const draft = useMemo(() => computeInvoiceDraftLine(row, percents), [row, percents]);
  const muted = isAssignmentMuted(row);
  const editable = !muted && draft.amount > 0.01;
  const selectionStatus = useMemo(
    () => getRowSelectionStatus(row, selection),
    [row, selection]
  );
  const selectable =
    isOperationalRowUiSelectable(row) || getSelectableDescendantRows(row).length > 0;

  const handleSelect = useCallback(() => {
    onToggleSelect(row);
  }, [onToggleSelect, row]);

  return (
    <CampaignOperationalTableRow className={cn("bq-krow", muted && "opacity-50")}>
      {cols.showExpand ? <CampaignOperationalTableCell /> : null}
      {cols.showSelect ? (
        <CampaignOperationalTableCell>
          <OperationalSelectionCheckbox
            status={selectionStatus}
            disabled={!selectable}
            onToggle={handleSelect}
            ariaLabel={`Select ${row.label}`}
          />
        </CampaignOperationalTableCell>
      ) : null}
      {cols.showCampaignNo ? (
        <CampaignOperationalTableCellMono className="text-[10px] text-muted-foreground">
          {row.document_number ?? "—"}
        </CampaignOperationalTableCellMono>
      ) : null}
      {lineSpan > 0 ? (
        <CampaignOperationalTableCell colSpan={lineSpan} className="font-semibold">
          {row.label}
        </CampaignOperationalTableCell>
      ) : null}
      {cols.showCurrency ? <CampaignOperationalTableCell /> : null}
      {cols.showTotal ? (
        <CampaignOperationalTableCellAmount className={amountClass(draft.amount)}>
          {formatBillingMoney(draft.amount, currency)}
        </CampaignOperationalTableCellAmount>
      ) : null}
      {cols.showAchieved ? (
        <CampaignOperationalTableCell className="text-right">
          <div className="bq-inw ml-auto flex items-center justify-end gap-0.5">
            <DraftNumericInput
              value={Number(formatDraftPercent(draft.percent))}
              ariaLabel={`Invoice percent for ${row.label}`}
              disabled={!editable}
              min={0}
              max={100}
              widthClass="w-14"
              onCommit={(percent) => onPercentChange(row.id, percent)}
            />
            <span className="text-[10px] text-muted-foreground">%</span>
          </div>
        </CampaignOperationalTableCell>
      ) : null}
      {cols.showInvoiced ? (
        <CampaignOperationalTableCellAmount>
          {editable ? (
            <div className="bq-inw">
              <DraftNumericInput
                value={draft.toBeInvoiced}
                ariaLabel={`To be invoiced for ${row.label}`}
                min={0}
                widthClass="w-[6.5rem]"
                onCommit={(amount) => onToBeInvoicedChange(row.id, amount)}
              />
            </div>
          ) : (
            formatBillingMoney(draft.toBeInvoiced, currency)
          )}
        </CampaignOperationalTableCellAmount>
      ) : null}
      {cols.showRemaining ? (
        <CampaignOperationalTableCellAmount className={amountClass(draft.vatAmount)}>
          {formatBillingMoney(draft.vatAmount, currency)}
        </CampaignOperationalTableCellAmount>
      ) : null}
      {cols.showUnachieved ? (
        <CampaignOperationalTableCellAmount>
          {formatBillingMoney(draft.totalInvoice, currency)}
        </CampaignOperationalTableCellAmount>
      ) : null}
      {cols.showStatus ? (
        <CampaignOperationalTableCell>
          <BillingStatusBadge status={resolveAssignmentBillingStatus(row)} />
        </CampaignOperationalTableCell>
      ) : null}
      {cols.showActions ? (
        <CampaignOperationalTableCellAmount
          className={cn(
            "text-[10px]",
            row.invoice_document_number ? undefined : "bq-v-z"
          )}
        >
          {row.invoice_document_number
            ? formatDocumentNumberForDisplay(row.invoice_document_number)
            : "—"}
        </CampaignOperationalTableCellAmount>
      ) : null}
    </CampaignOperationalTableRow>
  );
});

type BillingQueueAssignmentFooterRowProps = {
  assignmentCount: number;
  currency: string;
  drafts: InvoiceDraftLine[];
};

export function BillingQueueAssignmentFooterRow({
  assignmentCount,
  currency,
  drafts,
}: BillingQueueAssignmentFooterRowProps) {
  const cols = useBillingQueueColumnVisibility();
  const lineSpan =
    Number(cols.showClient) + Number(cols.showBrand) + Number(cols.showCampaign);
  const achieved = drafts.reduce((sum, d) => sum + d.amount, 0);
  const billed = drafts.reduce((sum, d) => sum + d.toBeInvoiced, 0);
  const vat = drafts.reduce((sum, d) => sum + d.vatAmount, 0);
  const total = drafts.reduce((sum, d) => sum + d.totalInvoice, 0);
  const remaining = drafts.reduce((sum, d) => sum + d.remaining, 0);

  return (
    <CampaignOperationalTableRow className="bq-ktot">
      {cols.showExpand ? <CampaignOperationalTableCell /> : null}
      {cols.showSelect ? <CampaignOperationalTableCell /> : null}
      {cols.showCampaignNo ? <CampaignOperationalTableCell /> : null}
      {lineSpan > 0 ? (
        <CampaignOperationalTableCell colSpan={lineSpan}>
          {assignmentCount} line{assignmentCount === 1 ? "" : "s"} in {currency}
        </CampaignOperationalTableCell>
      ) : null}
      {cols.showCurrency ? <CampaignOperationalTableCell /> : null}
      {cols.showTotal ? (
        <CampaignOperationalTableCellAmount>
          {formatBillingMoney(achieved, currency)}
        </CampaignOperationalTableCellAmount>
      ) : null}
      {cols.showAchieved ? <CampaignOperationalTableCell /> : null}
      {cols.showInvoiced ? (
        <CampaignOperationalTableCellAmount>
          {formatBillingMoney(billed, currency)}
        </CampaignOperationalTableCellAmount>
      ) : null}
      {cols.showRemaining ? (
        <CampaignOperationalTableCellAmount>
          {formatBillingMoney(vat, currency)}
        </CampaignOperationalTableCellAmount>
      ) : null}
      {cols.showUnachieved ? (
        <CampaignOperationalTableCellAmount>
          {formatBillingMoney(total, currency)}
        </CampaignOperationalTableCellAmount>
      ) : null}
      {cols.showStatus ? <CampaignOperationalTableCell /> : null}
      {cols.showActions ? (
        <CampaignOperationalTableCellAmount className="text-[10px]">
          rem {formatBillingMoney(remaining, currency)}
        </CampaignOperationalTableCellAmount>
      ) : null}
    </CampaignOperationalTableRow>
  );
}

export function BillingQueueTotalsRow({
  campaignCount,
  currency,
  total,
  invoiced,
  remaining,
}: {
  campaignCount: number;
  currency: string | null;
  total: number;
  invoiced: number;
  remaining: number;
}) {
  const cols = useBillingQueueColumnVisibility();
  const nameSpan =
    Number(cols.showCampaignNo) +
    Number(cols.showClient) +
    Number(cols.showBrand) +
    Number(cols.showCampaign);
  const formatAmount = (amount: number) =>
    currency
      ? formatBillingMoney(amount, currency)
      : amount.toLocaleString("en-US", { maximumFractionDigits: 0 });

  return (
    <CampaignOperationalTableRow className="bq-foot">
      {cols.showExpand ? <CampaignOperationalTableCell /> : null}
      {cols.showSelect ? <CampaignOperationalTableCell /> : null}
      {nameSpan > 0 ? (
        <CampaignOperationalTableCell colSpan={nameSpan}>
          {campaignCount} campaign{campaignCount === 1 ? "" : "s"}
        </CampaignOperationalTableCell>
      ) : null}
      {cols.showCurrency ? (
        <CampaignOperationalTableCell>
          {currency ? (
            <span className="bq-cc">{currency}</span>
          ) : (
            <span className="text-[8.5px] uppercase tracking-wide text-muted-foreground">
              Sum mixed
            </span>
          )}
        </CampaignOperationalTableCell>
      ) : null}
      {cols.showTotal ? (
        <CampaignOperationalTableCellAmount>{formatAmount(total)}</CampaignOperationalTableCellAmount>
      ) : null}
      {cols.showAchieved ? <CampaignOperationalTableCell /> : null}
      {cols.showInvoiced ? (
        <CampaignOperationalTableCellAmount>{formatAmount(invoiced)}</CampaignOperationalTableCellAmount>
      ) : null}
      {cols.showRemaining ? (
        <CampaignOperationalTableCellAmount>{formatAmount(remaining)}</CampaignOperationalTableCellAmount>
      ) : null}
      {cols.showUnachieved ? <CampaignOperationalTableCell /> : null}
      {cols.showStatus ? <CampaignOperationalTableCell /> : null}
      {cols.showActions ? <CampaignOperationalTableCell /> : null}
    </CampaignOperationalTableRow>
  );
}
