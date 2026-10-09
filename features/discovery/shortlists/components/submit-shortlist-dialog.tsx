
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
      <DialogContent className="sl-redesign sl-dialog sl-form-dialog">
        <DialogHeader>
          <DialogTitle>Submit shortlist for internal review?</DialogTitle>
          <DialogDescription>
            No creators are selected. Submit for internal review {creatorCount} creator
            {creatorCount === 1 ? "" : "s"} for internal review and move the shortlist to
            Under Review? This notifies the shortlist owner, creator and recorded approver. It does not send anything to the client.
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
