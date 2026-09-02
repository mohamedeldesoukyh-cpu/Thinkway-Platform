"use client";

import { memo, useCallback, useMemo, type CSSProperties, type HTMLAttributes, type MouseEventHandler, type ReactNode } from "react";

import { BillingStatusBadge } from "@/features/billing/components/billing-status-badge";
import { OperationalSelectionCheckbox } from "@/features/billing/components/operational-selection-checkbox";
import {
  DraftNumericInput,
  resolveAssignmentBillingStatus,
} from "@/features/billing/components/operational-row-tree";
import {
  billingQueueGridTemplate,
  formatQueueNumber,
  useBillingQueueColumnVisibility,
} from "@/features/billing/components/use-billing-queue-column-visibility";
import {
  isOperationalRowUiSelectable,
  type OperationalBillingRow,
} from "@/lib/billing/operational-billing-rows";
import {
  type InvoiceDraftLine,
  type InvoiceDraftPercents,
  computeInvoiceDraftLine,
} from "@/lib/billing/operational-invoice-draft";
import {
  getRowSelectionStatus,
  getSelectableDescendantRows,
  type OperationalSelectionState,
} from "@/lib/billing/operational-selection";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import { cn } from "@/lib/utils";

export function useBillingQueueGridTemplate() {
  const cols = useBillingQueueColumnVisibility();
  return { cols, template: billingQueueGridTemplate(cols) };
}

export function BillingQueueGrid({ children }: { children: ReactNode }) {
  return (
    <div className="bq-scroll">
      <div className="bq-grid">{children}</div>
    </div>
  );
}

export function BillingQueueGridRow({
  className,
  template,
  children,
  onClick,
  ...rest
}: {
  className?: string;
  template: string;
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLDivElement>;
} & HTMLAttributes<HTMLDivElement>) {
  const style: CSSProperties = { gridTemplateColumns: template };
  return (
    <div className={cn("bq-r", className)} style={style} onClick={onClick} {...rest}>
      {children}
    </div>
  );
}

export function BillingQueueMessageRow({ children }: { children: ReactNode }) {
  const { template } = useBillingQueueGridTemplate();
  return (
    <BillingQueueGridRow className="bq-krow" template={template}>
      <div className="bq-span text-[11px] text-muted-foreground">{children}</div>
    </BillingQueueGridRow>
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
  if (!(amount > 0.01)) return "bq-v z";
  return positive ? "bq-v pos" : "bq-v";
}

export function BillingQueueAssignmentHeaderRow() {
  const { cols, template } = useBillingQueueGridTemplate();
  const lineSpan =
    Number(cols.showClient) + Number(cols.showBrand) + Number(cols.showCampaign);

  return (
    <BillingQueueGridRow className="bq-khd" template={template}>
      {cols.showSelect ? <span /> : null}
      {cols.showExpand ? <span /> : null}
      {cols.showCampaignNo ? <span title="Assignment number">Line ref</span> : null}
      {lineSpan > 0 ? <span style={{ gridColumn: `span ${lineSpan}` }}>Line</span> : null}
      {cols.showCurrency ? <span /> : null}
      {cols.showTotal ? <span className="bq-rr" title="Line invoice amount">Achieved</span> : null}
      {cols.showAchieved ? (
        <span className="bq-rr" title="Share of remaining to bill now">Bill %</span>
      ) : null}
      {cols.showInvoiced ? (
        <span className="bq-rr" title="Amount to include on this invoice">Bill amount</span>
      ) : null}
      {cols.showRemaining ? <span className="bq-rr" title="VAT on this invoice">VAT</span> : null}
      {cols.showBillPercent ? <span /> : null}
      {cols.showUnachieved ? (
        <span className="bq-rr" title="Line total including VAT">Line total</span>
      ) : null}
      {cols.showStatus ? <span>State</span> : null}
      {cols.showActions ? <span className="bq-rr">Invoice</span> : null}
    </BillingQueueGridRow>
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
  const { cols, template } = useBillingQueueGridTemplate();
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
    <BillingQueueGridRow className={cn("bq-krow", muted && "opacity-50")} template={template}>
      {cols.showSelect ? (
        <span>
          <OperationalSelectionCheckbox
            status={selectionStatus}
            disabled={!selectable}
            onToggle={handleSelect}
            ariaLabel={`Select ${row.label}`}
          />
        </span>
      ) : null}
      {cols.showExpand ? <span /> : null}
      {cols.showCampaignNo ? (
        <span className="bq-kid">{row.document_number ?? "—"}</span>
      ) : null}
      {lineSpan > 0 ? (
        <span className="bq-kn" style={{ gridColumn: `span ${lineSpan}` }} title={row.label}>
          {row.label}
        </span>
      ) : null}
      {cols.showCurrency ? <span /> : null}
      {cols.showTotal ? (
        <span className={amountClass(draft.amount)}>{formatQueueNumber(draft.amount)}</span>
      ) : null}
      {cols.showAchieved ? (
        <span>
          <div
            className="bq-inw"
            title="Bill percent of remaining. Changing this updates nested grains on this line."
          >
            <DraftNumericInput
              value={Number(formatDraftPercent(draft.percent))}
              ariaLabel={`Invoice percent for ${row.label}`}
              disabled={!editable}
              min={0}
              max={100}
              widthClass="bq-in"
              onCommit={(percent) => onPercentChange(row.id, percent)}
            />
            <span>%</span>
          </div>
        </span>
      ) : null}
      {cols.showInvoiced ? (
        <span>
          {editable ? (
            <DraftNumericInput
              value={draft.toBeInvoiced}
              ariaLabel={`To be invoiced for ${row.label}`}
              min={0}
              widthClass="bq-in"
              onCommit={(amount) => onToBeInvoicedChange(row.id, amount)}
            />
          ) : (
            <span className={amountClass(draft.toBeInvoiced)}>
              {formatQueueNumber(draft.toBeInvoiced)}
            </span>
          )}
        </span>
      ) : null}
      {cols.showRemaining ? (
        <span className={amountClass(draft.vatAmount)}>{formatQueueNumber(draft.vatAmount)}</span>
      ) : null}
      {cols.showBillPercent ? <span /> : null}
      {cols.showUnachieved ? (
        <span className="bq-v">{formatQueueNumber(draft.totalInvoice)}</span>
      ) : null}
      {cols.showStatus ? (
        <span>
          <BillingStatusBadge status={resolveAssignmentBillingStatus(row)} />
        </span>
      ) : null}
      {cols.showActions ? (
        <span className={cn("bq-v", row.invoice_document_number ? undefined : "z")} style={{ fontSize: 10 }}>
          {row.invoice_document_number
            ? formatDocumentNumberForDisplay(row.invoice_document_number)
            : "—"}
        </span>
      ) : null}
    </BillingQueueGridRow>
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
  const { cols, template } = useBillingQueueGridTemplate();
  const lineSpan =
    Number(cols.showClient) + Number(cols.showBrand) + Number(cols.showCampaign);
  const achieved = drafts.reduce((sum, d) => sum + d.amount, 0);
  const billed = drafts.reduce((sum, d) => sum + d.toBeInvoiced, 0);
  const vat = drafts.reduce((sum, d) => sum + d.vatAmount, 0);
  const total = drafts.reduce((sum, d) => sum + d.totalInvoice, 0);
  const remaining = drafts.reduce((sum, d) => sum + d.remaining, 0);

  return (
    <BillingQueueGridRow className="bq-ktot" template={template}>
      {cols.showSelect ? <span /> : null}
      {cols.showExpand ? <span /> : null}
      {cols.showCampaignNo ? <span /> : null}
      {lineSpan > 0 ? (
        <span style={{ gridColumn: `span ${lineSpan}` }}>
          {assignmentCount} line{assignmentCount === 1 ? "" : "s"} in {currency}
        </span>
      ) : null}
      {cols.showCurrency ? <span /> : null}
      {cols.showTotal ? <span className="bq-v">{formatQueueNumber(achieved)}</span> : null}
      {cols.showAchieved ? <span /> : null}
      {cols.showInvoiced ? <span className="bq-v">{formatQueueNumber(billed)}</span> : null}
      {cols.showRemaining ? <span className="bq-v">{formatQueueNumber(vat)}</span> : null}
      {cols.showBillPercent ? <span /> : null}
      {cols.showUnachieved ? <span className="bq-v">{formatQueueNumber(total)}</span> : null}
      {cols.showStatus ? <span /> : null}
      {cols.showActions ? (
        <span className="bq-v" style={{ fontSize: 10 }}>
          rem {formatQueueNumber(remaining)}
        </span>
      ) : null}
    </BillingQueueGridRow>
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
  const { cols, template } = useBillingQueueGridTemplate();
  const nameSpan =
    Number(cols.showCampaignNo) +
    Number(cols.showClient) +
    Number(cols.showBrand) +
    Number(cols.showCampaign);

  return (
    <BillingQueueGridRow className="bq-foot" template={template}>
      {cols.showSelect ? <span /> : null}
      {cols.showExpand ? <span /> : null}
      {nameSpan > 0 ? (
        <span style={{ gridColumn: `span ${nameSpan}` }}>
          {campaignCount} campaign{campaignCount === 1 ? "" : "s"}
        </span>
      ) : null}
      {cols.showCurrency ? (
        <span>
          {currency ? (
            <span className="bq-cc">{currency}</span>
          ) : (
            <span className="text-[8.5px] uppercase tracking-wide text-muted-foreground">
              Sum mixed
            </span>
          )}
        </span>
      ) : null}
      {cols.showTotal ? <span className="bq-v">{formatQueueNumber(total)}</span> : null}
      {cols.showAchieved ? <span /> : null}
      {cols.showInvoiced ? <span className="bq-v">{formatQueueNumber(invoiced)}</span> : null}
      {cols.showRemaining ? <span className="bq-v">{formatQueueNumber(remaining)}</span> : null}
      {cols.showBillPercent ? <span /> : null}
      {cols.showUnachieved ? <span /> : null}
      {cols.showStatus ? <span /> : null}
      {cols.showActions ? <span /> : null}
    </BillingQueueGridRow>
  );
}
