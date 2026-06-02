"use client";

import { formatBillingMoney } from "@/features/billing/utils";
import type { InvoiceBatchFinancialPreview } from "@/lib/billing/invoice-batch-preview";
import { cn } from "@/lib/utils";

type InvoiceFinancialSummaryCardProps = {
  currency: string;
  preview: InvoiceBatchFinancialPreview;
  invoiceMode: "new" | "append";
  showPartialContext: boolean;
};

export function InvoiceFinancialSummaryCard({
  currency,
  preview,
  invoiceMode,
  showPartialContext,
}: InvoiceFinancialSummaryCardProps) {
  const hasBatch = preview.deliverableCount > 0;
  const vatLabel = preview.mixedVat
    ? "Mixed VAT rates applied"
    : preview.displayVatPercent != null && preview.displayVatPercent > 0
      ? `VAT (${formatVatPercent(preview.displayVatPercent)})`
      : preview.taxAmount > 0
        ? "VAT"
        : "VAT (0%)";

  return (
    <section
      className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm"
      aria-label="Financial summary"
    >
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Financial summary
      </h3>

      {!hasBatch ? (
        <p className="text-muted-foreground">
          Select billable rows to preview subtotal, VAT, and total after VAT.
        </p>
      ) : (
        <div className="space-y-1.5">
          <MoneyRow
            label="Subtotal"
            value={formatBillingMoney(preview.subtotal, currency)}
          />
          <MoneyRow
            label={vatLabel}
            value={formatBillingMoney(preview.taxAmount, currency)}
            muted
            note={preview.mixedVat ? "Per-line VAT applied" : undefined}
          />
          <div className="my-2 border-t border-border/80" aria-hidden />
          <MoneyRow
            label="Total after VAT"
            value={formatBillingMoney(preview.totalAfterVat, currency)}
            strong
          />
        </div>
      )}

      {showPartialContext && hasBatch ? (
        <div className="mt-3 space-y-1 border-t border-border/60 pt-3">
          <MoneyRow
            label="Selected batch subtotal"
            value={formatBillingMoney(preview.subtotal, currency)}
            muted
          />
          <MoneyRow
            label="Already invoiced"
            value={formatBillingMoney(preview.alreadyInvoiced, currency)}
            muted
          />
          <MoneyRow
            label="Remaining after this invoice"
            value={formatBillingMoney(preview.remainingAfterInvoice, currency)}
          />
        </div>
      ) : null}

      {invoiceMode === "append" && preview.appendCurrentTotal != null && hasBatch ? (
        <div className="mt-3 space-y-1 rounded-xl border border-dashed border-border/80 bg-background/60 px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">Append preview</p>
          <MoneyRow
            label="Current invoice total"
            value={formatBillingMoney(preview.appendCurrentTotal, currency)}
            muted
          />
          <MoneyRow
            label="This batch"
            value={formatBillingMoney(preview.totalAfterVat, currency)}
            muted
          />
          <div className="flex items-center justify-center py-0.5 text-muted-foreground" aria-hidden>
            =
          </div>
          <MoneyRow
            label="New invoice total"
            value={formatBillingMoney(preview.appendNewTotal ?? 0, currency)}
            strong
          />
        </div>
      ) : null}
    </section>
  );
}

function MoneyRow({
  label,
  value,
  strong,
  muted,
  note,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
  note?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className={cn(
          "min-w-0 shrink",
          muted ? "text-muted-foreground" : strong ? "font-medium" : undefined
        )}
      >
        {label}
        {note ? (
          <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
            {note}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "tabular-nums text-right",
          strong ? "text-base font-bold" : muted ? "text-muted-foreground" : "font-medium"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function formatVatPercent(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return `${rounded}%`;
}
