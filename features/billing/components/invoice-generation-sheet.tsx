"use client";

import { useRouter } from "next/navigation";
import {
  startTransition,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  resetToastOnce,
  showErrorToastOnce,
  showSuccessToastOnce,
} from "@/lib/ui/toast-once";

import { Button } from "@/components/ui/button";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
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
  invoiceSliceKey,
  percentFromAmount,
  resolveInvoiceSlice,
  serializeInvoiceSliceAllocations,
  type InvoiceSliceGrain,
} from "@/lib/billing/partial-assignment-invoice";
import { existingInvoiceTargetMode } from "@/lib/billing/invoice-existing-target";
import { isAppendableInvoiceStatus } from "@/lib/billing/invoice-status";
import {
  flattenOperationalLeaves,
  isOperationalRowUiSelectable,
  type OperationalBillingRow,
} from "@/lib/billing/operational-billing-rows";
import {
  buildInvoiceFormPayload,
  countSubmitPayload,
  createEmptySelection,
  getRowSelectionStatus,
  isRowInInvoiceSubmitPayload,
  payloadToSelection,
  toggleOperationalRowSelection,
  type OperationalSelectionPayload,
  type OperationalSelectionState,
} from "@/lib/billing/operational-selection";
import { cn } from "@/lib/utils";

export type InvoiceGenerationTargetMode = "new" | "append";

function sliceGrain(kind: OperationalBillingRow["kind"]): InvoiceSliceGrain {
  if (kind === "deliverable_group") return "deliverable";
  return kind;
}

function sliceKeyForRow(row: Pick<OperationalBillingRow, "kind" | "id">) {
  return invoiceSliceKey(sliceGrain(row.kind), row.id);
}

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
  /** Locked for this sheet session — no switching between new and append. */
  targetMode: InvoiceGenerationTargetMode;
  /** Pre-selected invoice when opened from target choice dialog. */
  initialExistingInvoiceId?: string;
  onInvoiceComplete?: (campaignId: string) => void | Promise<void>;
};

export function InvoiceGenerationSheet({
  campaignId,
  currency,
  rollup,
  operationalRows: operationalRowsProp,
  appendableInvoices: appendableInvoicesProp,
  defaultVatPercent = 0,
  open,
  onOpenChange,
  initialSelection,
  targetMode,
  initialExistingInvoiceId,
  onInvoiceComplete,
}: InvoiceGenerationSheetProps) {
  const operationalRows = operationalRowsProp ?? [];
  const appendableInvoices = appendableInvoicesProp ?? [];
  const safeRollup = rollup ?? {
    total_campaign_amount: 0,
    achieved_revenue: 0,
    already_invoiced: 0,
    remaining_to_invoice: 0,
    unachieved_revenue: 0,
  };

  const router = useRouter();
  const handledActionRef = useRef<string | null>(null);
  const sheetInitializedRef = useRef(false);
  const isAppend = targetMode === "append";
  const [selected, setSelected] = useState<OperationalSelectionState>(createEmptySelection());
  const [existingInvoiceId, setExistingInvoiceId] = useState("");
  const [sliceByKey, setSliceByKey] = useState<Record<string, { percent: number; amount: number }>>(
    {}
  );
  const [bulkPercent, setBulkPercent] = useState("50");

  const appendableOptions = useMemo(
    () =>
      appendableInvoices.filter((invoice) => {
        if (invoice.status === "void" || invoice.status === "paid") return false;
        if (existingInvoiceTargetMode(invoice) === "regenerate") return true;
        return !invoice.is_locked && isAppendableInvoiceStatus(invoice.status);
      }),
    [appendableInvoices]
  );

  useEffect(() => {
    if (!open) {
      sheetInitializedRef.current = false;
      setSelected(createEmptySelection());
      setExistingInvoiceId("");
      setSliceByKey({});
      setBulkPercent("50");
      return;
    }

    handledActionRef.current = null;
    resetToastOnce("invoice-generation");

    if (!sheetInitializedRef.current) {
      sheetInitializedRef.current = true;
      if (initialSelection) {
        setSelected(payloadToSelection(initialSelection));
      }
    }

    if (isAppend && appendableOptions.length > 0) {
      setExistingInvoiceId(
        initialExistingInvoiceId ?? appendableOptions[0]?.id ?? ""
      );
    } else {
      setExistingInvoiceId("");
    }
  }, [open, initialSelection, isAppend, appendableOptions, initialExistingInvoiceId]);

  const invoiceSheetLeaves = useMemo(() => {
    return flattenOperationalLeaves(operationalRows).filter(
      (row) => row.billable_amount > 0 || row.invoiced_amount > 0
    );
  }, [operationalRows]);

  const selectedAppendInvoice = useMemo(
    () => appendableOptions.find((inv) => inv.id === existingInvoiceId) ?? null,
    [appendableOptions, existingInvoiceId]
  );

  const submitPayload = useMemo(
    () => buildInvoiceFormPayload(selected, operationalRows, invoiceSheetLeaves),
    [selected, operationalRows, invoiceSheetLeaves]
  );

  const billedByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const [key, slice] of Object.entries(sliceByKey)) {
      map.set(key, slice.amount);
    }
    return map;
  }, [sliceByKey]);

  const financialPreview = useMemo(
    () =>
      computeInvoiceBatchFinancialPreview({
        operationalRows,
        selection: payloadToSelection(submitPayload),
        defaultVatPercent,
        campaignRollup: {
          already_invoiced: safeRollup.already_invoiced,
          remaining_to_invoice: safeRollup.remaining_to_invoice,
        },
        appendInvoice:
          isAppend && selectedAppendInvoice ? { total: selectedAppendInvoice.total } : null,
        billedByKey,
      }),
    [
      operationalRows,
      submitPayload,
      defaultVatPercent,
      safeRollup.already_invoiced,
      safeRollup.remaining_to_invoice,
      isAppend,
      selectedAppendInvoice,
      billedByKey,
    ]
  );

  const showPartialContext =
    safeRollup.already_invoiced > 0 ||
    financialPreview.remainingAfterInvoice < safeRollup.remaining_to_invoice;

  const [state, formAction, pending] = useActionState(
    createInvoiceFromLinesAction,
    { ok: false } satisfies BillingActionState
  );

  useEffect(() => {
    if (!state.message) return;

    const actionKey = `${state.ok}:${state.message}:${state.invoiceId ?? ""}:${state.campaignId ?? campaignId}`;
    if (handledActionRef.current === actionKey) return;
    handledActionRef.current = actionKey;

    if (state.ok) {
      showSuccessToastOnce(state.message, { id: "invoice-generation", duration: 6000 });
      const completedCampaignId = state.campaignId ?? campaignId;
      void (async () => {
        if (completedCampaignId && onInvoiceComplete) {
          await onInvoiceComplete(completedCampaignId);
        }
        router.refresh();
        if (open) {
          onOpenChange(false);
        }
      })();
    } else if (open) {
      showErrorToastOnce(state.message, { id: "invoice-generation" });
    }
  }, [
    open,
    state.message,
    state.ok,
    state.invoiceId,
    state.campaignId,
    onOpenChange,
    onInvoiceComplete,
    campaignId,
    router,
  ]);

  function toggleLeafRow(row: OperationalBillingRow) {
    setSelected((prev) => toggleOperationalRowSelection(row, prev, operationalRows));
    const key = sliceKeyForRow(row);
    setSliceByKey((prev) => {
      if (prev[key]) return prev;
      const remaining = Math.max(0, row.remaining_amount);
      return {
        ...prev,
        [key]: { percent: 100, amount: remaining },
      };
    });
  }

  function setRowPercent(row: OperationalBillingRow, percent: number) {
    const remaining = Math.max(0, row.remaining_amount);
    const slice = resolveInvoiceSlice({ remaining, requestedPercent: percent });
    setSliceByKey((prev) => ({
      ...prev,
      [sliceKeyForRow(row)]: {
        percent: slice.percentOfRemaining || percent,
        amount: slice.billedAmount,
      },
    }));
  }

  function setRowAmount(row: OperationalBillingRow, amount: number) {
    const remaining = Math.max(0, row.remaining_amount);
    const slice = resolveInvoiceSlice({ remaining, requestedAmount: amount });
    setSliceByKey((prev) => ({
      ...prev,
      [sliceKeyForRow(row)]: {
        percent: slice.error ? percentFromAmount(remaining, amount) : slice.percentOfRemaining,
        amount: slice.error ? amount : slice.billedAmount,
      },
    }));
  }

  function applyBulkPercentToSelected() {
    const percent = Number(bulkPercent);
    if (!Number.isFinite(percent)) return;
    const next = { ...sliceByKey };
    for (const row of invoiceSheetLeaves) {
      if (!isRowInInvoiceSubmitPayload(row, payload)) continue;
      const remaining = Math.max(0, row.remaining_amount);
      const slice = resolveInvoiceSlice({ remaining, requestedPercent: percent });
      next[sliceKeyForRow(row)] = {
        percent: slice.percentOfRemaining || percent,
        amount: slice.billedAmount,
      };
    }
    setSliceByKey(next);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = buildInvoiceFormPayload(selected, operationalRows, invoiceSheetLeaves);
    if (countSubmitPayload(payload) === 0) return;

    const allocations: Record<string, number> = {};
    for (const row of invoiceSheetLeaves) {
      if (!isRowInInvoiceSubmitPayload(row, payload)) continue;
      const key = sliceKeyForRow(row);
      const remaining = Math.max(0, row.remaining_amount);
      const amount = sliceByKey[key]?.amount ?? remaining;
      allocations[key] = amount;
    }

    const formData = new FormData();
    formData.set("campaign_id", campaignId);
    formData.set("line_ids", payload.line_ids.join(","));
    formData.set("deliverable_ids", payload.deliverable_ids.join(","));
    formData.set("post_ids", payload.post_ids.join(","));
    formData.set("invoice_mode", targetMode);
    formData.set("existing_invoice_id", isAppend ? existingInvoiceId : "");
    formData.set("allocations", serializeInvoiceSliceAllocations(allocations));

    const notes = event.currentTarget.elements.namedItem("notes");
    if (notes instanceof HTMLTextAreaElement && notes.value.trim()) {
      formData.set("notes", notes.value.trim());
    }

    if (!isAppend) {
      const dueDate = event.currentTarget.elements.namedItem("due_date");
      if (dueDate instanceof HTMLInputElement && dueDate.value.trim()) {
        formData.set("due_date", dueDate.value.trim());
      }
    }

    startTransition(() => {
      formAction(formData);
    });
  }

  const payload = submitPayload;
  const hasSelection = countSubmitPayload(payload) > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full max-h-[100dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <SheetHeader className="shrink-0 border-b px-6 py-4">
          <SheetTitle>{isAppend ? "Append to existing invoice" : "Create new invoice"}</SheetTitle>
          <SheetDescription>
            {isAppend
              ? "Adds the selected operational rows to one open invoice. This does not create a new invoice number."
              : "Issues a new invoice number (INV-…) for the selected rows only. Each submission creates a separate invoice."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
            <div className="flex flex-col gap-4">
              <div className="grid gap-2 rounded-3xl border p-4 text-sm">
                <SummaryRow
                  label="Total campaign amount"
                  value={formatBillingMoneyCompact(safeRollup.total_campaign_amount, currency)}
                />
                <SummaryRow
                  label="Achieved revenue"
                  value={formatBillingMoneyCompact(safeRollup.achieved_revenue, currency)}
                />
                <SummaryRow
                  label="Already invoiced"
                  value={formatBillingMoneyCompact(safeRollup.already_invoiced, currency)}
                />
                <SummaryRow
                  label="Remaining to invoice"
                  value={formatBillingMoneyCompact(safeRollup.remaining_to_invoice, currency)}
                  strong
                />
              </div>

              <InvoiceFinancialSummaryCard
                currency={currency}
                preview={financialPreview}
                invoiceMode={targetMode}
                showPartialContext={showPartialContext}
              />

              <div className="space-y-2">
                {invoiceSheetLeaves.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No billable rows selected. Generate Vendor IO on assignments, then select
                    deliverables with remaining revenue.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-end gap-2 rounded-2xl border p-3">
                      <div className="space-y-1">
                        <Label htmlFor="bulk_percent" className="text-xs">
                          Apply % to selected
                        </Label>
                        <Input
                          id="bulk_percent"
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          className="h-8 w-24"
                          value={bulkPercent}
                          onChange={(event) => setBulkPercent(event.target.value)}
                        />
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={applyBulkPercentToSelected}>
                        Apply
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Percent and amount stay linked. 100% bills remaining on that row.
                      </p>
                    </div>
                  {invoiceSheetLeaves.map((row) => {
                    const selectable = isOperationalRowUiSelectable(row);
                    const locked = !selectable;
                    const status = getRowSelectionStatus(row, selected);
                    const inSubmitPayload = isRowInInvoiceSubmitPayload(row, payload);
                    const checked = selectable && inSubmitPayload;
                    const key = sliceKeyForRow(row);
                    const remaining = Math.max(0, row.remaining_amount);
                    const slice = sliceByKey[key] ?? { percent: 100, amount: remaining };
                    const remainingAfter = Math.max(0, remaining - (checked ? slice.amount : 0));

                    return (
                      <div
                        key={`${row.kind}-${row.id}`}
                        className={cn(
                          "flex items-start gap-3 rounded-2xl border p-2",
                          locked
                            ? "bg-muted/30 opacity-70"
                            : "hover:bg-muted/40"
                        )}
                      >
                        <label className={cn("flex items-start gap-3 min-w-0 flex-1", locked ? "cursor-not-allowed" : "cursor-pointer")}>
                        <OperationalSelectionCheckbox
                          status={checked ? "checked" : status}
                          disabled={locked}
                          onToggle={() => {
                            if (!locked) toggleLeafRow(row);
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{row.label}</p>
                          {locked && row.invoice_document_number ? (
                            <p className="text-xs text-muted-foreground">
                              Invoiced ·{" "}
                              {formatDocumentNumberForDisplay(row.invoice_document_number)}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              {formatBillingMoney(row.remaining_amount, currency)} uninvoiced
                              {checked
                                ? ` · ${formatBillingMoney(remainingAfter, currency)} after this invoice`
                                : ""}
                            </p>
                          )}
                        </div>
                        </label>
                        {checked && !locked ? (
                          <div
                            className="flex shrink-0 items-center gap-2"
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step={0.01}
                              className="h-8 w-16"
                              aria-label="Percent to invoice"
                              value={slice.percent}
                              onChange={(event) =>
                                setRowPercent(row, Number(event.target.value) || 0)
                              }
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              className="h-8 w-28"
                              aria-label="Amount to invoice"
                              value={slice.amount}
                              onChange={(event) =>
                                setRowAmount(row, Number(event.target.value) || 0)
                              }
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  </>
                )}
              </div>

              {isAppend ? (
                <div className="space-y-2">
                  <Label htmlFor="existing_invoice">Existing invoice</Label>
                  {appendableOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No appendable invoices available. Locked, paid, void, or exported
                      invoices cannot receive additional rows. Use Create new invoice instead.
                    </p>
                  ) : (
                    <Select value={existingInvoiceId} onValueChange={setExistingInvoiceId}>
                      <SelectTrigger id="existing_invoice">
                        <SelectValue placeholder="Select open invoice" />
                      </SelectTrigger>
                      <SelectContent>
                        {appendableOptions.map((inv) => (
                          <SelectItem key={inv.id} value={inv.id}>
                            {existingInvoiceTargetMode(inv) === "regenerate"
                              ? `Regenerate ${formatDocumentNumberForDisplay(inv.document_number)} (pending)`
                              : formatDocumentNumberForDisplay(inv.document_number)}
                            {" · "}
                            {formatBillingMoney(inv.total, inv.currency)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="due_date">Due date</Label>
                  <Input id="due_date" name="due_date" type="date" />
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
                (isAppend && (!existingInvoiceId || appendableOptions.length === 0))
              }
            >
              {isAppend ? "Append to invoice" : "Create new invoice"}
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
