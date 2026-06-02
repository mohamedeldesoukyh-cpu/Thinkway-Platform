"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  createInvoiceFromLinesAction,
  type BillingActionState,
} from "@/features/billing/actions";
import { InvoiceFinancialSummaryCard } from "@/features/billing/components/invoice-financial-summary-card";
import { OperationalSelectionCheckbox } from "@/features/billing/components/operational-selection-checkbox";
import type { AppendableInvoiceOption } from "@/features/billing/types";
import { formatBillingMoney, formatBillingMoneyCompact } from "@/features/billing/utils";
import { computeInvoiceBatchFinancialPreview } from "@/lib/billing/invoice-batch-preview";
import {
  flattenOperationalLeaves,
  isOperationalRowInvoiceEligible,
  type OperationalBillingRow,
} from "@/lib/billing/operational-billing-rows";
import {
  buildInvoiceSelectionBatch,
  countSelection,
  createEmptySelection,
  getRowSelectionStatus,
  isRowEffectivelySelected,
  payloadToSelection,
  selectionToPayload,
  toggleOperationalRowSelection,
  type OperationalSelectionPayload,
  type OperationalSelectionState,
} from "@/lib/billing/operational-selection";

type InvoiceGenerationSheetProps = {
  campaignId: string;
  currency: string;
  rollup: {
    total_campaign_amount: number;
    achieved_revenue: number;
    already_invoiced: number;
    remaining_to_invoice: number;
    unachieved_revenue: number;
  };
  operationalRows: OperationalBillingRow[];
  appendableInvoices: AppendableInvoiceOption[];
  defaultVatPercent?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSelection?: OperationalSelectionPayload;
  initialInvoiceMode?: "new" | "append";
  onInvoiceComplete?: (campaignId: string) => void | Promise<void>;
};

export function InvoiceGenerationSheet({
  campaignId,
  currency,
  rollup,
  operationalRows,
  appendableInvoices,
  defaultVatPercent = 0,
  open,
  onOpenChange,
  initialSelection,
  initialInvoiceMode = "new",
  onInvoiceComplete,
}: InvoiceGenerationSheetProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<OperationalSelectionState>(createEmptySelection());
  const [invoiceMode, setInvoiceMode] = useState<"new" | "append">("new");
  const [existingInvoiceId, setExistingInvoiceId] = useState("");

  const appendableOptions = useMemo(
    () =>
      appendableInvoices.filter(
        (invoice) =>
          !invoice.is_locked &&
          invoice.status !== "void" &&
          invoice.status !== "paid" &&
          invoice.status !== "cancelled"
      ),
    [appendableInvoices]
  );

  useEffect(() => {
    if (!open) {
      setSelected(createEmptySelection());
      setInvoiceMode("new");
      setExistingInvoiceId("");
      return;
    }

    if (initialSelection) {
      setSelected(payloadToSelection(initialSelection));
      buildInvoiceSelectionBatch(payloadToSelection(initialSelection), operationalRows);
    }

    setInvoiceMode(initialInvoiceMode);
    if (initialInvoiceMode === "append" && appendableOptions.length > 0) {
      setExistingInvoiceId(appendableOptions[0]?.id ?? "");
    } else {
      setExistingInvoiceId("");
    }

    if (appendableOptions.length > 0 && process.env.NODE_ENV === "development") {
      console.debug("[append-to-existing] appendable invoices available for selection", {
        count: appendableOptions.length,
        invoiceIds: appendableOptions.map((invoice) => invoice.id),
      });
    }
  }, [open, initialSelection, initialInvoiceMode, appendableOptions, operationalRows]);

  const eligibleLeaves = useMemo(() => {
    return flattenOperationalLeaves(operationalRows).filter((row) =>
      isOperationalRowInvoiceEligible(row)
    );
  }, [operationalRows]);

  const selectedAppendInvoice = useMemo(
    () => appendableOptions.find((inv) => inv.id === existingInvoiceId) ?? null,
    [appendableOptions, existingInvoiceId]
  );

  const financialPreview = useMemo(
    () =>
      computeInvoiceBatchFinancialPreview({
        operationalRows,
        selection: selected,
        defaultVatPercent,
        campaignRollup: {
          already_invoiced: rollup.already_invoiced,
          remaining_to_invoice: rollup.remaining_to_invoice,
        },
        appendInvoice:
          invoiceMode === "append" && selectedAppendInvoice
            ? { total: selectedAppendInvoice.total }
            : null,
      }),
    [
      operationalRows,
      selected,
      defaultVatPercent,
      rollup.already_invoiced,
      rollup.remaining_to_invoice,
      invoiceMode,
      selectedAppendInvoice,
    ]
  );

  const showPartialContext =
    rollup.already_invoiced > 0 ||
    financialPreview.remainingAfterInvoice < rollup.remaining_to_invoice;

  const [state, formAction, pending] = useActionState(
    createInvoiceFromLinesAction,
    { ok: false } satisfies BillingActionState
  );

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      const completedCampaignId = state.campaignId ?? campaignId;
      void (async () => {
        if (completedCampaignId && onInvoiceComplete) {
          await onInvoiceComplete(completedCampaignId);
        }
        router.refresh();
        onOpenChange(false);
      })();
    } else {
      toast.error(state.message);
    }
  }, [state, onOpenChange, onInvoiceComplete, campaignId, router]);

  function toggleLeafRow(row: OperationalBillingRow) {
    setSelected((prev) => toggleOperationalRowSelection(row, prev, operationalRows));
  }

  function handleInvoiceModeChange(mode: "new" | "append") {
    setInvoiceMode(mode);
    if (process.env.NODE_ENV === "development") {
      console.debug("[invoice-mode] invoice target selected", {
        mode,
        appendableCount: appendableOptions.length,
      });
    }
    if (mode === "new") {
      setExistingInvoiceId("");
    }
  }

  const payload = selectionToPayload(selected);
  const hasSelection = countSelection(selected) > 0;
  const requiresAppendChoice = appendableOptions.length > 0 && hasSelection;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full max-h-[100dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <SheetHeader className="shrink-0 border-b px-6 py-4">
          <SheetTitle>Generate invoice</SheetTitle>
          <SheetDescription>
            Selected operational rows are grouped into one invoice operation. Choose a new invoice
            or append to an existing open invoice for this campaign.
          </SheetDescription>
        </SheetHeader>

        <form
          action={formAction}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <input type="hidden" name="campaign_id" value={campaignId} />
          <input type="hidden" name="line_ids" value={payload.line_ids.join(",")} />
          <input type="hidden" name="deliverable_ids" value={payload.deliverable_ids.join(",")} />
          <input type="hidden" name="post_ids" value={payload.post_ids.join(",")} />
          <input type="hidden" name="invoice_mode" value={invoiceMode} />
          <input type="hidden" name="existing_invoice_id" value={existingInvoiceId} />

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
            <div className="flex flex-col gap-4">
              <div className="grid gap-2 rounded-3xl border p-4 text-sm">
                <SummaryRow
                  label="Total campaign amount"
                  value={formatBillingMoneyCompact(rollup.total_campaign_amount, currency)}
                />
                <SummaryRow
                  label="Achieved revenue"
                  value={formatBillingMoneyCompact(rollup.achieved_revenue, currency)}
                />
                <SummaryRow
                  label="Already invoiced"
                  value={formatBillingMoneyCompact(rollup.already_invoiced, currency)}
                />
                <SummaryRow
                  label="Remaining to invoice"
                  value={formatBillingMoneyCompact(rollup.remaining_to_invoice, currency)}
                  strong
                />
              </div>

              <InvoiceFinancialSummaryCard
                currency={currency}
                preview={financialPreview}
                invoiceMode={invoiceMode}
                showPartialContext={showPartialContext}
              />

              <div className="space-y-2">
                {eligibleLeaves.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No operational rows ready for invoicing. Approve and move assignments to billing
                    first.
                  </p>
                ) : (
                  eligibleLeaves.map((row) => {
                    const status = getRowSelectionStatus(row, selected);
                    const effectivelySelected =
                      status === "checked" ||
                      isRowEffectivelySelected(row, selected, operationalRows);

                    return (
                      <label
                        key={`${row.kind}-${row.id}`}
                        className="flex cursor-pointer items-start gap-3 rounded-2xl border p-2 hover:bg-muted/40"
                      >
                        <OperationalSelectionCheckbox
                          status={effectivelySelected ? "checked" : status}
                          onToggle={() => toggleLeafRow(row)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{row.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatBillingMoney(row.remaining_amount, currency)} uninvoiced
                          </p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>

              {requiresAppendChoice ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
                  Open invoices exist for this campaign. Choose whether to create a new invoice or
                  append selected rows to an existing one.
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>Invoice target</Label>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="invoice_mode_ui"
                      checked={invoiceMode === "new"}
                      onChange={() => handleInvoiceModeChange("new")}
                    />
                    Create new invoice
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="invoice_mode_ui"
                      checked={invoiceMode === "append"}
                      disabled={appendableOptions.length === 0}
                      onChange={() => handleInvoiceModeChange("append")}
                    />
                    Add to existing invoice
                  </label>
                </div>
              </div>

              {invoiceMode === "new" ? (
                <div className="space-y-2">
                  <Label htmlFor="due_date">Due date</Label>
                  <Input id="due_date" name="due_date" type="date" />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="existing_invoice">Existing invoice</Label>
                  {appendableOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No appendable invoices available. Locked, paid, cancelled, or exported
                      invoices cannot receive additional rows.
                    </p>
                  ) : (
                    <Select value={existingInvoiceId} onValueChange={setExistingInvoiceId}>
                      <SelectTrigger id="existing_invoice">
                        <SelectValue placeholder="Select open invoice" />
                      </SelectTrigger>
                      <SelectContent>
                        {appendableOptions.map((inv) => (
                          <SelectItem key={inv.id} value={inv.id}>
                            {inv.document_number} · {formatBillingMoney(inv.total, inv.currency)}{" "}
                            · {inv.status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={2} />
              </div>
            </div>
          </div>

          <SheetFooter className="shrink-0 border-t bg-background px-6 py-4">
            <Button
              type="submit"
              className="w-full"
              disabled={
                pending ||
                !hasSelection ||
                (invoiceMode === "append" && !existingInvoiceId)
              }
            >
              {invoiceMode === "append" ? "Append to invoice" : "Create invoice"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold" : undefined}>{value}</span>
    </div>
  );
}
