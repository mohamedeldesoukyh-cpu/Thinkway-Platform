"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  previewApplyCampaignScriptAction,
  type CampaignScriptActionResult,
} from "@/features/campaigns/actions/campaign-script-actions";
import type { ApplyMasterScriptPreview } from "@/lib/campaign-script";

export function ApplyCampaignScriptDialog({
  open,
  onOpenChange,
  campaignId,
  lineIds,
  applying,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  lineIds: string[];
  applying: boolean;
  onConfirm: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<ApplyMasterScriptPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPreview(null);
    setError(null);
    startTransition(async () => {
      const result: CampaignScriptActionResult<ApplyMasterScriptPreview> =
        await previewApplyCampaignScriptAction({ campaignId, lineIds });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPreview(result.data);
    });
  }, [campaignId, lineIds, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apply Campaign Script</DialogTitle>
          <DialogDescription>
            Selected assignments expand to unique creators. Inherited creators follow the
            current master. Customized scripts stay unchanged.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : pending && !preview ? (
          <p className="text-sm text-muted-foreground">Checking selected creators…</p>
        ) : preview ? (
          <div className="grid gap-3 text-sm">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Master Script
              </p>
              <p className="mt-1 font-medium">
                Current · {preview.masterVersion ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Creators
              </p>
              <ul className="mt-1 space-y-1 text-[13px] text-foreground">
                <li>{preview.creatorCount} selected</li>
                <li>{preview.willCreate} will be newly assigned</li>
                <li>{preview.alreadyInherited} already inherit this script</li>
                <li>
                  {preview.keptCustomized}{" "}
                  {preview.keptCustomized === 1
                    ? "has a customized script and will be kept unchanged"
                    : "have customized scripts and will be kept unchanged"}
                </li>
              </ul>
            </div>
            {preview.keptCustomized > 0 ? (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-950 dark:text-amber-100">
                {preview.keptCustomized === 1
                  ? "1 creator has a customized script. Their customized version will remain unchanged."
                  : `${preview.keptCustomized} creators have customized scripts. Those versions will remain unchanged.`}
              </p>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={applying || pending || !preview || preview.creatorCount === 0}
            onClick={onConfirm}
          >
            {applying ? "Applying…" : "Apply Script"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
