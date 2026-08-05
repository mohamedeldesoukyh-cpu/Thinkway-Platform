"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
import { createAndSubmitCommercialRevisionAction } from "@/features/campaigns/actions/commercial-revision-actions";
import {
  diffMasterChanges,
  masterFieldLabel,
} from "@/lib/services/commercial/field-registry";
import type { MasterCommercialValues } from "@/lib/services/commercial/types";

export type CommercialRevisionDialogLine = {
  commercialLineId: string;
  assignmentIds?: string[];
  current: MasterCommercialValues;
  proposed: MasterCommercialValues;
  concurrencyToken?: string | null;
};

type CommercialRevisionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignHeaderId: string;
  quotationId: string;
  lines: CommercialRevisionDialogLine[];
  onSubmitted?: () => void;
};

function formatValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function CommercialRevisionDialog({
  open,
  onOpenChange,
  campaignHeaderId,
  quotationId,
  lines,
  onSubmitted,
}: CommercialRevisionDialogProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [comments, setComments] = useState("");
  const [pending, startTransition] = useTransition();

  const fieldChanges = useMemo(
    () =>
      lines.flatMap((line) => {
        const { fieldChanges: changes } = diffMasterChanges(
          line.current,
          line.proposed
        );
        return changes.map((change) => ({
          commercialLineId: line.commercialLineId,
          label: change.label || masterFieldLabel(change.field),
          oldValue: change.oldValue,
          newValue: change.newValue,
        }));
      }),
    [lines]
  );

  function handleSubmit() {
    if (!reason.trim()) {
      toast.error("Reason is required");
      return;
    }
    if (fieldChanges.length === 0) {
      toast.error("No Master commercial changes to revise");
      return;
    }

    startTransition(async () => {
      const result = await createAndSubmitCommercialRevisionAction({
        campaignHeaderId,
        quotationId,
        reason,
        comments,
        lines: lines.map((line) => ({
          commercialLineId: line.commercialLineId,
          assignmentIds: line.assignmentIds,
          proposed: line.proposed,
          concurrencyToken: line.concurrencyToken,
        })),
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message ?? "Commercial Revision submitted");
      setReason("");
      setComments("");
      onOpenChange(false);
      onSubmitted?.();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Commercial Revision</DialogTitle>
          <DialogDescription>
            This Campaign has entered the finance process. Commercial values
            cannot be edited directly. Submit a Commercial Revision for
            approval.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="mb-2 font-medium">Proposed Master changes</p>
            {fieldChanges.length === 0 ? (
              <p className="text-muted-foreground">
                No dirty Master fields. Issue/validity dates are document metadata
                and are not revised here — change cost, revenue, GP, fees, or
                currency to create a Commercial Revision.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {fieldChanges.map((change, index) => (
                  <li key={`${change.commercialLineId}-${change.label}-${index}`}>
                    <span className="text-muted-foreground">
                      {change.label}:
                    </span>{" "}
                    {formatValue(change.oldValue)} →{" "}
                    <span className="font-medium">
                      {formatValue(change.newValue)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="commercial-revision-reason">Reason</Label>
            <Textarea
              id="commercial-revision-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why must these commercial values change?"
              rows={3}
              disabled={pending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="commercial-revision-comments">
              Comments (optional)
            </Label>
            <Textarea
              id="commercial-revision-comments"
              value={comments}
              onChange={(event) => setComments(event.target.value)}
              placeholder="Additional context for approvers"
              rows={2}
              disabled={pending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={pending}>
            {pending ? "Submitting…" : "Submit for Approval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
