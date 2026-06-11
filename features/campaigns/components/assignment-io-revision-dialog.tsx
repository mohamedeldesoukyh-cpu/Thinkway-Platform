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
            Vendor IO revision will be generated under the same IO number ({ioLabel}). The
            next revision will use the same serial with an incremented suffix (for example{" "}
            {ioLabel}/1, {ioLabel}/2) and updated commercial values.
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
