"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppendableInvoiceOption } from "@/features/billing/types";
import { existingInvoiceTargetMode } from "@/lib/billing/invoice-existing-target";
import { isAppendableInvoiceStatus } from "@/lib/billing/invoice-status";
import { formatBillingMoney } from "@/features/billing/utils";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";

export type InvoiceTargetMode = "new" | "append";

type InvoiceTargetChoiceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appendableInvoices: AppendableInvoiceOption[];
  onConfirm: (mode: InvoiceTargetMode, existingInvoiceId?: string) => void;
};

export function InvoiceTargetChoiceDialog({
  open,
  onOpenChange,
  appendableInvoices,
  onConfirm,
}: InvoiceTargetChoiceDialogProps) {
  const eligible = appendableInvoices.filter((inv) => {
    if (inv.status === "void" || inv.status === "paid") return false;
    if (existingInvoiceTargetMode(inv) === "regenerate") return true;
    return !inv.is_locked && isAppendableInvoiceStatus(inv.status);
  });

  const [existingInvoiceId, setExistingInvoiceId] = useState("");

  useEffect(() => {
    if (!open) {
      setExistingInvoiceId("");
      return;
    }
    setExistingInvoiceId(eligible[0]?.id ?? "");
  }, [open, eligible]);

  function confirmAppend() {
    if (!existingInvoiceId) return;
    onConfirm("append", existingInvoiceId);
    onOpenChange(false);
  }

  function confirmNew() {
    onConfirm("new");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invoice target</DialogTitle>
          <DialogDescription>
            This campaign already has an open or pending invoice. Add to / regenerate that
            invoice, or create a new one (the pending invoice is then cancelled).
          </DialogDescription>
        </DialogHeader>

        {eligible.length > 0 ? (
          <div className="space-y-2">
            <Label htmlFor="existing_invoice_pick">Existing invoice</Label>
            <Select value={existingInvoiceId} onValueChange={setExistingInvoiceId}>
              <SelectTrigger id="existing_invoice_pick">
                <SelectValue placeholder="Select invoice" />
              </SelectTrigger>
              <SelectContent>
                {eligible.map((inv) => (
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
          </div>
        ) : null}

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
          {eligible.length > 0 ? (
            <Button type="button" onClick={confirmAppend} disabled={!existingInvoiceId}>
              Add to existing invoice
            </Button>
          ) : null}
          <Button type="button" variant={eligible.length > 0 ? "outline" : "default"} onClick={confirmNew}>
            Create new invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
