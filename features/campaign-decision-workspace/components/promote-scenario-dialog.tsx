"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type PromoteScenarioDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenarioName: string;
  isPromoting: boolean;
  error: string | null;
  onConfirm: (reason: string) => void;
  disabled?: boolean;
};

export function PromoteScenarioDialog({
  open,
  onOpenChange,
  scenarioName,
  isPromoting,
  error,
  onConfirm,
  disabled,
}: PromoteScenarioDialogProps) {
  const [reason, setReason] = useState("");

  return (
    <>
      <Button
        type="button"
        className="bg-[#1D9E75] hover:bg-[#178f68]"
        disabled={disabled || isPromoting}
        onClick={() => onOpenChange(true)}
      >
        Promote Scenario
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote Scenario</DialogTitle>
            <DialogDescription>
              Apply &quot;{scenarioName}&quot; to create a new CampaignObject version. This is
              the only action that mutates the approved campaign. Campaign Studio will reflect
              the promoted version.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for promotion (optional)"
            rows={3}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#1D9E75] hover:bg-[#178f68]"
              disabled={isPromoting}
              onClick={() => onConfirm(reason)}
            >
              {isPromoting ? "Promoting…" : "Confirm Promotion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
