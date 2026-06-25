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

export function GenerateQuotationShortlistDialog({
  open,
  onOpenChange,
  creatorCount,
  shortlistName,
  onConfirm,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorCount: number;
  shortlistName: string;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate quotation for entire shortlist?</DialogTitle>
          <DialogDescription>
            No creators are selected. Create a quotation with all {creatorCount} creator
            {creatorCount === 1 ? "" : "s"} from &ldquo;{shortlistName}&rdquo;?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            Generate quotation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
