"use client";

import { useActionState, useEffect, useState } from "react";
import { Undo2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
  ungenerateVendorIoAction,
  type UngenerateVendorIoState,
} from "@/features/io/ungenerate-vendor-io-action";
import type { VendorIoRow } from "@/features/io/types";

type VendorIoUngenerateDialogProps = {
  row: Pick<
    VendorIoRow,
    "id" | "campaign_header_id" | "document_number" | "influencer_name"
  >;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function VendorIoUngenerateDialog({
  row,
  open,
  onOpenChange,
}: VendorIoUngenerateDialogProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [state, action, pending] = useActionState(ungenerateVendorIoAction, {
    ok: false,
  } satisfies UngenerateVendorIoState);

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

  const label = row.document_number
    ? formatDocumentNumberForDisplay(row.document_number)
    : "Vendor IO";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Un-generate Vendor IO</DialogTitle>
          <DialogDescription>
            Remove {label} for {row.influencer_name} and return linked assignment lines to
            draft. Only allowed when no linked line has been invoiced.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-3">
          <input type="hidden" name="vendor_io_id" value={row.id} />
          <input type="hidden" name="campaign_header_id" value={row.campaign_header_id} />
          <div className="grid gap-2">
            <Label htmlFor="vio_ungenerate_reason">Reason (required)</Label>
            <Textarea
              id="vio_ungenerate_reason"
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={3}
              placeholder="Scope change, wrong creator batch, duplicate IO…"
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

type VendorIoUngenerateTriggerProps = {
  row: VendorIoRow;
  variant?: "menu" | "button";
  disabled?: boolean;
  title?: string;
  onBeforeOpen?: () => void;
};

export function VendorIoUngenerateTrigger({
  row,
  variant = "button",
  disabled,
  title,
  onBeforeOpen,
}: VendorIoUngenerateTriggerProps) {
  const [open, setOpen] = useState(false);

  function handleOpen() {
    onBeforeOpen?.();
    setOpen(true);
  }

  return (
    <>
      {variant === "menu" ? (
        <button
          type="button"
          className="flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
          disabled={disabled}
          title={title}
          onClick={handleOpen}
        >
          <Undo2Icon className="size-3.5" />
          Un-generate IO
        </button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[10px]"
          disabled={disabled}
          title={title}
          onClick={handleOpen}
        >
          <Undo2Icon className="size-3" />
          Ungenerate IO
        </Button>
      )}
      <VendorIoUngenerateDialog row={row} open={open} onOpenChange={setOpen} />
    </>
  );
}
