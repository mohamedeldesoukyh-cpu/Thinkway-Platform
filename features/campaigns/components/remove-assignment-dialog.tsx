
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { removeCampaignAssignmentAction } from "@/features/campaigns/actions/remove-assignment";
import { useRefreshCampaignAfterOperationalMutation } from "@/features/campaigns/hooks/campaign-operational-refresh";

export function RemoveAssignmentDialog({ campaignId, lineId, name, onClose }: {
  campaignId: string; lineId: string; name: string; onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const refresh = useRefreshCampaignAfterOperationalMutation();
  return <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
    <DialogContent>
      <DialogHeader><DialogTitle>Remove creator from assignment</DialogTitle>
        <DialogDescription>Cancel {name} and their pending deliverables, withdraw uninvoiced billing, and cancel their Vendor IO. Creator profiles, IO documents and approval history are preserved. An issued Client IO is marked for amendment. Invoices, payments, published work or an IO shared with other active assignments will block this action.</DialogDescription>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">If you only selected the wrong creator and want to retain the price and deliverables, cancel and choose “Replace creator / edit” instead.</p>
      <p className="text-sm text-muted-foreground">Confirm cancellation has been agreed where required. No notification is sent automatically.</p>
      <Label htmlFor="assignment-removal-reason">Reason</Label>
      <Textarea id="assignment-removal-reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={2000} disabled={pending} />
      <DialogFooter><Button variant="outline" disabled={pending} onClick={onClose}>Cancel</Button>
        <Button variant="destructive" disabled={pending || reason.trim().length < 3} onClick={() => startTransition(async () => {
          try {
            const result = await removeCampaignAssignmentAction({ campaignId, lineId, reason });
            if (!result.ok) { toast.error(result.message); return; }
            toast.success(result.message); onClose(); refresh();
          } catch { toast.error("Could not remove the assignment. Please try again."); }
        })}>{pending ? "Removing…" : "Remove from campaign"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
