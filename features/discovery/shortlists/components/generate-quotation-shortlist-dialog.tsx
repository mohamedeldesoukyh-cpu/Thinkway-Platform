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
  existingQuotationLabel,
  onGenerateNew,
  onAddToQuotation,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorCount: number;
  shortlistName: string;
  existingQuotationLabel?: string | null;
  onGenerateNew: () => void;
  onAddToQuotation: () => void;
  busy?: boolean;
}) {
  const countLabel = `${creatorCount} creator${creatorCount === 1 ? "" : "s"}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quotation for entire shortlist</DialogTitle>
          <DialogDescription>
            No creators are selected. Choose how to quote all {countLabel} from
            &ldquo;{shortlistName}&rdquo;.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-1">
          <Button
            type="button"
            className="h-auto justify-start px-3 py-2.5 text-left"
            onClick={onGenerateNew}
            disabled={busy}
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold">Generate new</span>
              <span className="text-[11px] font-normal text-primary-foreground/80">
                Create a new quotation with all creators
              </span>
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto justify-start px-3 py-2.5 text-left"
            onClick={onAddToQuotation}
            disabled={busy}
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold">Add to quotation</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                {existingQuotationLabel
                  ? `Add all creators to ${existingQuotationLabel}`
                  : "Add to the linked quotation, or create one if none exists"}
              </span>
            </span>
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
