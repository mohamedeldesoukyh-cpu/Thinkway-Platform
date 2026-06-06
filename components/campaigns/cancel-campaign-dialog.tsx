"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cancelCampaignAction,
  previewCancelCampaignAction,
  type CampaignCancelActionState,
} from "@/features/campaigns/actions/cancel-campaign";
import { CANCELLED_DISPLAY_CLASS } from "@/lib/finance/status/cancellation-status";

type CancelCampaignDialogProps = {
  campaignId: string;
  campaignName: string;
  disabled?: boolean;
};

export function CancelCampaignDialog({
  campaignId,
  campaignName,
  disabled,
}: CancelCampaignDialogProps) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<CampaignCancelActionState["preview"]>();
  const [state, formAction, pending] = useActionState(cancelCampaignAction, {
    ok: false,
  });

  useEffect(() => {
    if (!open) return;
    previewCancelCampaignAction(campaignId).then((result) => {
      if (result.preview) setPreview(result.preview);
    });
  }, [open, campaignId]);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={disabled}>
          Cancel campaign
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel campaign</DialogTitle>
          <DialogDescription>
            Cancel <span className="font-medium">{campaignName}</span>. Serial numbers and audit
            history are preserved.
          </DialogDescription>
        </DialogHeader>

        {preview && !preview.allowed ? (
          <p className="text-sm text-destructive">{preview.reason}</p>
        ) : null}

        {preview?.has_vendor_ios ? (
          <p className={CANCELLED_DISPLAY_CLASS}>
            All Vendor IOs and operational flows will be cancelled. This action preserves serial
            numbers and audit history.
          </p>
        ) : null}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="campaign_id" value={campaignId} />
          <div className="grid gap-2">
            <Label htmlFor="cancel_reason">Reason (optional)</Label>
            <Input id="cancel_reason" name="reason" placeholder="Cancellation reason" />
          </div>
          {state.message && !state.ok ? (
            <p className="text-sm text-destructive">{state.message}</p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={pending || (preview !== undefined && !preview.allowed)}
            >
              {pending ? "Cancelling…" : "Confirm cancellation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
