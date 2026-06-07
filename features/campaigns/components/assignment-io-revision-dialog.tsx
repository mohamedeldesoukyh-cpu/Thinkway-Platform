"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AssignmentIoRevisionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorIoDocumentNumber: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function AssignmentIoRevisionDialog({
  open,
  onOpenChange,
  vendorIoDocumentNumber,
  onConfirm,
  onCancel,
}: AssignmentIoRevisionDialogProps) {
  const ioLabel = vendorIoDocumentNumber ?? "Vendor IO";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Commercial change affects Vendor IO</DialogTitle>
          <DialogDescription>
            This assignment was un-generated from an invoice. Saving revises {ioLabel}{" "}
            under the same serial (for example /2, /3) with the updated creator cost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm}>
            Acknowledge and save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
