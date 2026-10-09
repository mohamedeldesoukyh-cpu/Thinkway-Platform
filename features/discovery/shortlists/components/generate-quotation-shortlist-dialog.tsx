
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
  selectedCount = 0,
  shortlistName,
  existingQuotationLabel,
  onGenerateNew,
  onAddToQuotation,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorCount: number;
  selectedCount?: number;
  shortlistName: string;
  existingQuotationLabel?: string | null;
  onGenerateNew: () => void;
  onAddToQuotation: () => void;
  busy?: boolean;
}) {
  const countLabel = `${creatorCount} creator${creatorCount === 1 ? "" : "s"}`;
  const scope = selectedCount > 0 ? `${selectedCount} selected creator${selectedCount === 1 ? "" : "s"}` : `all ${countLabel}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sl-redesign sl-dialog sl-form-dialog">
        <DialogHeader>
          <DialogTitle>Generate quotation for {scope}</DialogTitle>
          <DialogDescription>
            Choose how to quote {scope} from
            &ldquo;{shortlistName}&rdquo;.
          </DialogDescription>
        </DialogHeader>
        <div className="sl-dialog-body grid gap-2">
          <Button
            type="button"
            className="h-auto justify-start px-3 py-2.5 text-left"
            onClick={onGenerateNew}
            disabled={busy}
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold">Generate for {scope}</span>
              <span className="text-[11px] font-normal text-primary-foreground/80">
                Create a new quotation with {scope}
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
                  ? `Add ${scope} to ${existingQuotationLabel}`
                  : `Add ${scope} to the linked quotation, or create one if none exists`}
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
