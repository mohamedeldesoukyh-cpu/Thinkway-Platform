"use client";

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
import type { AppendableInvoiceOption } from "@/features/billing/types";
import { formatBillingMoney, formatBillingMoneyCompact } from "@/features/billing/utils";
import {
  flattenOperationalLeaves,
  isOperationalRowInvoiceEligible,
  type OperationalBillingRow,
} from "@/lib/billing/operational-billing-rows";

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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSelection?: {
    line_ids?: string[];
    deliverable_ids?: string[];
    post_ids?: string[];
  };
};

export function InvoiceGenerationSheet({
  campaignId,
  currency,
  rollup,
  operationalRows,
  appendableInvoices,
  open,
  onOpenChange,
  initialSelection,
}: InvoiceGenerationSheetProps) {
  const [selected, setSelected] = useState<{
    line_ids: Set<string>;
    deliverable_ids: Set<string>;
    post_ids: Set<string>;
  }>({ line_ids: new Set(), deliverable_ids: new Set(), post_ids: new Set() });
  const [invoiceMode, setInvoiceMode] = useState<"new" | "append">("new");
  const [existingInvoiceId, setExistingInvoiceId] = useState("");

  useEffect(() => {
    if (!open) {
      setSelected({ line_ids: new Set(), deliverable_ids: new Set(), post_ids: new Set() });
      setInvoiceMode("new");
      setExistingInvoiceId("");
      return;
    }
    if (initialSelection) {
      setSelected({
        line_ids: new Set(initialSelection.line_ids ?? []),
        deliverable_ids: new Set(initialSelection.deliverable_ids ?? []),
        post_ids: new Set(initialSelection.post_ids ?? []),
      });
    }
  }, [open, initialSelection]);

  const eligibleLeaves = useMemo(() => {
    return flattenOperationalLeaves(operationalRows).filter((row) =>
      isOperationalRowInvoiceEligible(row)
    );
  }, [operationalRows]);

  const selectedTotal = useMemo(() => {
    const leaves = flattenOperationalLeaves(operationalRows);
    return leaves
      .filter((row) => {
        if (row.kind === "assignment") return selected.line_ids.has(row.id);
        if (row.kind === "deliverable_group") return selected.deliverable_ids.has(row.id);
        return selected.post_ids.has(row.id);
      })
      .reduce((sum, row) => sum + row.remaining_amount, 0);
  }, [operationalRows, selected]);

  const [state, formAction, pending] = useActionState(
    createInvoiceFromLinesAction,
    { ok: false } satisfies BillingActionState
  );

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      onOpenChange(false);
    } else {
      toast.error(state.message);
    }
  }, [state, onOpenChange]);

  function toggleRow(row: OperationalBillingRow) {
    setSelected((prev) => {
      const next = {
        line_ids: new Set(prev.line_ids),
        deliverable_ids: new Set(prev.deliverable_ids),
        post_ids: new Set(prev.post_ids),
      };
      const set =
        row.kind === "assignment"
          ? next.line_ids
          : row.kind === "deliverable_group"
            ? next.deliverable_ids
            : next.post_ids;
      if (set.has(row.id)) set.delete(row.id);
      else set.add(row.id);

      if (process.env.NODE_ENV === "development") {
        console.debug("[invoice-generation] selected operational row ids", {
          line_ids: [...next.line_ids],
          deliverable_ids: [...next.deliverable_ids],
          post_ids: [...next.post_ids],
        });
      }

      return next;
    });
  }

  const hasSelection =
    selected.line_ids.size + selected.deliverable_ids.size + selected.post_ids.size > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-hidden sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Generate invoice</SheetTitle>
          <SheetDescription>
            Select operational rows for partial billing. Create a new invoice or append to an
            existing open invoice.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-2 rounded-3xl border p-4 text-sm">
          <SummaryRow label="Total campaign amount" value={formatBillingMoneyCompact(rollup.total_campaign_amount, currency)} />
          <SummaryRow label="Achieved revenue" value={formatBillingMoneyCompact(rollup.achieved_revenue, currency)} />
          <SummaryRow label="Already invoiced" value={formatBillingMoneyCompact(rollup.already_invoiced, currency)} />
          <SummaryRow label="Remaining to invoice" value={formatBillingMoneyCompact(rollup.remaining_to_invoice, currency)} strong />
          {selectedTotal > 0 ? (
            <SummaryRow label="This invoice" value={formatBillingMoney(selectedTotal, currency)} strong />
          ) : null}
        </div>

        <form action={formAction} className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <input type="hidden" name="campaign_id" value={campaignId} />
          <input type="hidden" name="line_ids" value={[...selected.line_ids].join(",")} />
          <input type="hidden" name="deliverable_ids" value={[...selected.deliverable_ids].join(",")} />
          <input type="hidden" name="post_ids" value={[...selected.post_ids].join(",")} />
          <input type="hidden" name="invoice_mode" value={invoiceMode} />
          <input type="hidden" name="existing_invoice_id" value={existingInvoiceId} />

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {eligibleLeaves.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No operational rows ready for invoicing. Approve and move assignments to billing
                first.
              </p>
            ) : (
              eligibleLeaves.map((row) => (
                <label
                  key={`${row.kind}-${row.id}`}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl border p-2 hover:bg-muted/40"
                >
                  <input
                    type="checkbox"
                    className="mt-1 size-4 rounded border-border"
                    checked={
                      row.kind === "assignment"
                        ? selected.line_ids.has(row.id)
                        : row.kind === "deliverable_group"
                          ? selected.deliverable_ids.has(row.id)
                          : selected.post_ids.has(row.id)
                    }
                    onChange={() => toggleRow(row)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{row.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBillingMoney(row.remaining_amount, currency)} uninvoiced
                    </p>
                  </div>
                </label>
              ))
            )}
          </div>

          <div className="space-y-2">
            <Label>Invoice target</Label>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="invoice_mode_ui"
                  checked={invoiceMode === "new"}
                  onChange={() => setInvoiceMode("new")}
                />
                Create new invoice
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="invoice_mode_ui"
                  checked={invoiceMode === "append"}
                  disabled={appendableInvoices.length === 0}
                  onChange={() => setInvoiceMode("append")}
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
              <Select value={existingInvoiceId} onValueChange={setExistingInvoiceId}>
                <SelectTrigger id="existing_invoice">
                  <SelectValue placeholder="Select open invoice" />
                </SelectTrigger>
                <SelectContent>
                  {appendableInvoices.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.document_number} · {formatBillingMoney(inv.total, inv.currency)} ·{" "}
                      {inv.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending || !hasSelection}>
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
