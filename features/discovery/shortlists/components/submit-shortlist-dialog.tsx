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

export function SubmitShortlistDialog({
  open,
  onOpenChange,
  creatorCount,
  onConfirm,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorCount: number;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit entire shortlist?</DialogTitle>
          <DialogDescription>
            No creators are selected. Submit all {creatorCount} creator
            {creatorCount === 1 ? "" : "s"} for review and move the shortlist to
            Under Review?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            Submit all
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
