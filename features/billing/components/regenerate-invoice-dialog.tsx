"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
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
  regenerateInvoiceAction,
  type BillingActionState,
} from "@/features/billing/actions";
import type { OperationalSelectionPayload } from "@/lib/billing/operational-selection";
import {
  showErrorToastOnce,
  showSuccessToastOnce,
} from "@/lib/ui/toast-once";

type RegenerateInvoiceDialogProps = {
  invoiceId: string;
  documentNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
  /** Assignment selection — limits regeneration to chosen lines only. */
  selection?: OperationalSelectionPayload;
};

export function RegenerateInvoiceDialog({
  invoiceId,
  documentNumber,
  open,
  onOpenChange,
  onComplete,
  selection,
}: RegenerateInvoiceDialogProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const handledRef = useRef<string | null>(null);

  const [state, action, pending] = useActionState(regenerateInvoiceAction, {
    ok: false,
  } satisfies BillingActionState);

  useEffect(() => {
    if (!open) {
      setReason("");
      handledRef.current = null;
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!state.message) return;
    const actionKey = `${state.ok}:${state.message}`;
    if (handledRef.current === actionKey) return;
    handledRef.current = actionKey;

    if (state.ok) {
      showSuccessToastOnce(state.message, { id: "invoice-regenerate" });
      onOpenChange(false);
      setReason("");
      onComplete?.();
      router.refresh();
    } else {
      showErrorToastOnce(state.message, { id: "invoice-regenerate" });
    }
  }, [state.message, state.ok, onOpenChange, onComplete, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Regenerate invoice</DialogTitle>
          <DialogDescription>
            Rebuild {formatDocumentNumberForDisplay(documentNumber)} from corrected assignment
            commercial terms. The same invoice number is preserved.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-3">
          <input type="hidden" name="invoice_id" value={invoiceId} />
          <input
            type="hidden"
            name="line_ids"
            value={(selection?.line_ids ?? []).join(",")}
          />
          <input
            type="hidden"
            name="deliverable_ids"
            value={(selection?.deliverable_ids ?? []).join(",")}
          />
          <div className="grid gap-2">
            <Label htmlFor="regenerate_invoice_reason">Reason (required)</Label>
            <Textarea
              id="regenerate_invoice_reason"
              name="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              rows={3}
              placeholder="Commercial correction after un-generate…"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || reason.trim().length < 3}>
              <RefreshCwIcon data-icon="inline-start" />
              {pending ? "Regenerating…" : "Regenerate invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
