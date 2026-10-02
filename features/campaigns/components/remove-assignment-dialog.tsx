"use client";

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
        <DialogDescription>Remove {name} from the active campaign. Their creator profile and assignment history stay in the system. An issued Client IO will require an amendment; its original document and approval remain recorded.</DialogDescription>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">If you only selected the wrong creator and want to retain the price and deliverables, cancel and choose “Replace creator / edit” instead.</p>
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
