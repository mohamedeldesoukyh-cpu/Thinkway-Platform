"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { BillingLineRow } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";

type CreateInvoiceSheetProps = {
  campaignId: string;
  lines: BillingLineRow[];
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateInvoiceSheet({
  campaignId,
  lines,
  currency,
  open,
  onOpenChange,
}: CreateInvoiceSheetProps) {
  const eligible = lines.filter((l) =>
    ["moved_to_billing", "approved"].includes(l.billing_status) && !l.invoice_id
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [state, formAction, pending] = useActionState(
    createInvoiceFromLinesAction,
    { ok: false } satisfies BillingActionState
  );

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      onOpenChange(false);
      setSelected(new Set());
    } else {
      toast.error(state.message);
    }
  }, [state, onOpenChange]);

  function toggleLine(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedTotal = eligible
    .filter((l) => selected.has(l.id))
    .reduce((s, l) => s + l.revenue, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Create invoice</SheetTitle>
          <SheetDescription>
            Select campaign lines to invoice. Revenue, cost, and vendor assignments
            will be locked.
          </SheetDescription>
        </SheetHeader>

        <form action={formAction} className="mt-6 space-y-4">
          <input type="hidden" name="campaign_id" value={campaignId} />
          <input
            type="hidden"
            name="line_ids"
            value={[...selected].join(",")}
          />

          <div className="space-y-3">
            {eligible.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No lines ready for invoicing. Approve and move lines to billing first.
              </p>
            ) : (
              eligible.map((line) => (
                <label
                  key={line.id}
                  className="flex cursor-pointer items-start gap-3 rounded-3xl border p-3 hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    className="mt-1 size-4 rounded border-border"
                    checked={selected.has(line.id)}
                    onChange={() => toggleLine(line.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{line.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {line.document_number}
                    </p>
                    <p className="text-sm">
                      {formatBillingMoney(line.revenue, line.currency_code || currency)}
                    </p>
                  </div>
                </label>
              ))
            )}
          </div>

          {selected.size > 0 ? (
            <p className="text-sm font-medium">
              Invoice total: {formatBillingMoney(selectedTotal, currency)}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="due_date">Due date</Label>
            <Input id="due_date" name="due_date" type="date" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} />
          </div>

          <SheetFooter className="px-0">
            <Button
              type="submit"
              disabled={pending || selected.size === 0}
            >
              Create invoice & lock lines
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
