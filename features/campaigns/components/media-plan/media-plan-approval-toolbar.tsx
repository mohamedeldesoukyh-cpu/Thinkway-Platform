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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  approveMediaPlanAction,
  lockMediaPlanAction,
  rejectMediaPlanAction,
  requestMediaPlanChangesAction,
  unlockMediaPlanAction,
} from "@/features/campaign-outputs/actions/media-plan-lifecycle-actions";
import type { MediaPlanStatus } from "@/lib/media-plan";

type MediaPlanApprovalToolbarProps = {
  campaignId: string;
  campaignObjectId: string;
  conversationId: string;
  status: MediaPlanStatus;
  hasApprovedBaseline: boolean;
  hasWorkingDraft: boolean;
  onCompare?: () => void;
  onHistory?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
};

type DialogMode =
  | "unlock"
  | "approve_client"
  | "approve_behalf"
  | "request_changes"
  | "reject"
  | null;

export function MediaPlanApprovalToolbar({
  campaignId,
  campaignObjectId,
  conversationId,
  status,
  hasApprovedBaseline,
  hasWorkingDraft,
  onCompare,
  onHistory,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: MediaPlanApprovalToolbarProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [notes, setNotes] = useState("");
  const [approvalSource, setApprovalSource] = useState<
    "email" | "whatsapp" | "phone" | "meeting" | "other"
  >("email");

  const base = { campaignObjectId, conversationId, campaignId };

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
        {onHistory ? (
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={onHistory}>
            History
          </Button>
        ) : null}
        {onUndo && canUndo ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={pending}
            onClick={onUndo}
          >
            Undo
          </Button>
        ) : null}
        {onRedo && canRedo ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={pending}
            onClick={onRedo}
          >
            Redo
          </Button>
        ) : null}
        {hasApprovedBaseline && hasWorkingDraft && onCompare ? (
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={onCompare}>
            Compare
          </Button>
        ) : null}

        {status === "draft" ? (
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs"
            disabled={pending}
            onClick={() => run(() => lockMediaPlanAction(base))}
          >
            Lock Media Plan
          </Button>
        ) : null}

        {status === "locked" || status === "draft" ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={pending}
              onClick={() => setDialog("approve_client")}
            >
              Approved by Client
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={pending}
              onClick={() => setDialog("approve_behalf")}
            >
              Approve on Behalf
            </Button>
          </>
        ) : null}

        {status === "locked" ? (
          <>
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
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              disabled={pending}
              onClick={() => setDialog("unlock")}
            >
              Unlock
            </Button>
          </>
        ) : null}

        {status === "approved_by_client" || status === "approved_on_behalf" ? (
          <>
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
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              disabled={pending}
              onClick={() => setDialog("unlock")}
            >
              Unlock
            </Button>
          </>
        ) : null}

        {pending ? <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" /> : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <Dialog open={dialog != null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog === "unlock" && "Unlock Media Plan"}
              {dialog === "approve_client" && "Approved by Client"}
              {dialog === "approve_behalf" && "Approve on Behalf of Client"}
              {dialog === "request_changes" && "Request Changes"}
              {dialog === "reject" && "Reject Media Plan"}
            </DialogTitle>
            <DialogDescription>
              {dialog === "unlock" &&
                "Unlocking an approved plan preserves the baseline and opens a new working draft. A new client approval will be required."}
              {dialog === "approve_client" &&
                "Records that the client approved this Media Plan. The current tip becomes the immutable Current Approved Baseline."}
              {dialog === "approve_behalf" &&
                "Records external approval (email, WhatsApp, phone, meeting). The tip becomes the immutable Current Approved Baseline."}
              {dialog === "request_changes" &&
                "Returns the plan to an editable draft. Approved baselines stay frozen."}
              {dialog === "reject" &&
                "Rejects the locked plan awaiting approval and returns it to draft."}
            </DialogDescription>
          </DialogHeader>

          {dialog === "approve_behalf" ? (
            <div className="space-y-2">
              <Label htmlFor="approval-source">Approval source</Label>
              <Select
                value={approvalSource}
                onValueChange={(value) =>
                  setApprovalSource(value as typeof approvalSource)
                }
              >
                <SelectTrigger id="approval-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="media-plan-notes">Notes (optional)</Label>
            <Textarea
              id="media-plan-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Optional context for the audit trail"
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
                if (dialog === "unlock") {
                  run(() => unlockMediaPlanAction({ ...base, reason: notes || undefined }));
                } else if (dialog === "approve_client") {
                  run(() =>
                    approveMediaPlanAction({
                      ...base,
                      method: "client_portal",
                      notes: notes || undefined,
                    })
                  );
                } else if (dialog === "approve_behalf") {
                  run(() =>
                    approveMediaPlanAction({
                      ...base,
                      method: "on_behalf",
                      approvalSource,
                      notes: notes || undefined,
                    })
                  );
                } else if (dialog === "request_changes") {
                  run(() =>
                    requestMediaPlanChangesAction({ ...base, notes: notes || undefined })
                  );
                } else if (dialog === "reject") {
                  run(() => rejectMediaPlanAction({ ...base, notes: notes || undefined }));
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
