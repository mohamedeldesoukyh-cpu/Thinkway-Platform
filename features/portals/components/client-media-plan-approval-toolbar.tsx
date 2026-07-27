"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  clientApproveMediaPlanAction,
  clientRejectMediaPlanAction,
  clientRequestMediaPlanChangesAction,
} from "@/features/portals/actions/client-media-plan-actions";
import type { ClientMediaPlanPayload } from "@/features/portals/queries/client-media-plan-payload";

type DialogMode = "approve" | "request_changes" | "reject" | null;

type ClientMediaPlanApprovalToolbarProps = {
  payload: ClientMediaPlanPayload;
};

export function ClientMediaPlanApprovalToolbar({
  payload,
}: ClientMediaPlanApprovalToolbarProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [notes, setNotes] = useState("");

  if (
    !payload.canDecide ||
    !payload.campaignObjectId ||
    !payload.conversationId ||
    payload.emptyReason
  ) {
    return null;
  }

  const base = {
    campaignId: payload.campaignId,
    campaignObjectId: payload.campaignObjectId,
    conversationId: payload.conversationId,
  };

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (!result.ok) {
        setError(result.message ?? "Action failed.");
        return;
      }
      setDialog(null);
      setNotes("");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {payload.canApprove ? (
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs"
            disabled={pending}
            onClick={() => setDialog("approve")}
          >
            Approve
          </Button>
        ) : null}
        {payload.canRequestChanges ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={pending}
            onClick={() => setDialog("request_changes")}
          >
            Request Changes
          </Button>
        ) : null}
        {payload.canReject ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={pending}
            onClick={() => setDialog("reject")}
          >
            Reject
          </Button>
        ) : null}
        {pending ? <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" /> : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <Dialog open={dialog != null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog === "approve" && "Approve Media Plan"}
              {dialog === "request_changes" && "Request Changes"}
              {dialog === "reject" && "Reject Media Plan"}
            </DialogTitle>
            <DialogDescription>
              {dialog === "approve" &&
                "Approves this Media Plan as the Current Approved Baseline. Actual and Remaining will follow this plan."}
              {dialog === "request_changes" &&
                "Returns the plan for internal revision. Any previously approved baseline stays frozen."}
              {dialog === "reject" &&
                "Rejects the Media Plan awaiting approval and returns it for internal revision."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="client-media-plan-notes">Notes (optional)</Label>
            <Textarea
              id="client-media-plan-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Optional feedback for the Thinkway team"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                const withNotes = { ...base, notes: notes || undefined };
                if (dialog === "approve") {
                  run(() => clientApproveMediaPlanAction(withNotes));
                } else if (dialog === "request_changes") {
                  run(() => clientRequestMediaPlanChangesAction(withNotes));
                } else if (dialog === "reject") {
                  run(() => clientRejectMediaPlanAction(withNotes));
                }
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
