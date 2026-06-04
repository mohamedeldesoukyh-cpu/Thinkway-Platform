"use client";

import { useActionState, useEffect, useState } from "react";
import { Undo2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import {
  ungenerateInvoiceAction,
  type BillingActionState,
} from "@/features/billing/actions";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";

type InvoiceUngenerateDialogProps = {
  invoiceId: string;
  documentNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function InvoiceUngenerateDialog({
  invoiceId,
  documentNumber,
  open,
  onOpenChange,
}: InvoiceUngenerateDialogProps) {
  const router = useRouter();
  const displayNumber = formatDocumentNumberForDisplay(documentNumber);
  const [reason, setReason] = useState("");
  const [state, action, pending] = useActionState(ungenerateInvoiceAction, {
    ok: false,
  } satisfies BillingActionState);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      onOpenChange(false);
      setReason("");
      router.refresh();
    } else {
      toast.error(state.message);
    }
  }, [state, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Un-generate invoice</DialogTitle>
          <DialogDescription>
            Unlock lines linked to {displayNumber}. Invoice number {displayNumber} remains
            reserved; totals are preserved until regenerated.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-3">
          <input type="hidden" name="invoice_id" value={invoiceId} />
          <div className="grid gap-2">
            <Label htmlFor="ungenerate_reason">Reason (required)</Label>
            <Textarea
              id="ungenerate_reason"
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={3}
              placeholder="Operational correction, pricing error, scope change…"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={pending || reason.trim().length < 3}
            >
              {pending ? "Un-generating…" : "Confirm un-generate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type InvoiceUngenerateTriggerProps = {
  invoiceId: string;
  documentNumber: string;
  disabled?: boolean;
  title?: string;
};

export function InvoiceUngenerateTrigger({
  invoiceId,
  documentNumber,
  disabled,
  title,
}: InvoiceUngenerateTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 text-[10px]"
        disabled={disabled}
        title={title}
        onClick={() => setOpen(true)}
      >
        <Undo2Icon className="size-3" />
        Ungenerate
      </Button>
      <InvoiceUngenerateDialog
        invoiceId={invoiceId}
        documentNumber={documentNumber}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
