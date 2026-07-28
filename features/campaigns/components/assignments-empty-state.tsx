"use client";

import { useState } from "react";
import { ClipboardListIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BackfillAssignmentsWizard } from "@/features/campaigns/components/backfill-assignments-wizard";

type AssignmentsEmptyStateProps = {
  campaignId?: string;
  quotationId?: string | null;
  onCreateAssignment?: () => void;
  createDisabled?: boolean;
};

export function AssignmentsEmptyState({
  campaignId,
  quotationId,
  onCreateAssignment,
  createDisabled = false,
}: AssignmentsEmptyStateProps) {
  const [backfillOpen, setBackfillOpen] = useState(false);
  const showBackfill = Boolean(campaignId && quotationId);

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-14 text-center">
      <div className="flex size-11 items-center justify-center rounded-xl bg-muted/60">
        <ClipboardListIcon className="size-5 text-muted-foreground" />
      </div>
      <div className="max-w-md space-y-1.5">
        <p className="text-sm font-semibold text-foreground">No assignments yet</p>
        <p className="text-sm text-muted-foreground">
          {showBackfill
            ? "This Campaign was created before Release 2.0 and does not contain Assignments. Backfill from the linked quotation, or create an assignment manually."
            : "Create an assignment to add a creator, deliverables, and posting schedule. Vendor IO and invoicing start only after you define assignments explicitly."}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {showBackfill ? (
          <Button type="button" onClick={() => setBackfillOpen(true)}>
            Backfill Assignments
          </Button>
        ) : null}
        {onCreateAssignment ? (
          <Button
            type="button"
            variant={showBackfill ? "outline" : "default"}
            onClick={onCreateAssignment}
            disabled={createDisabled}
          >
            <PlusIcon data-icon="inline-start" />
            Create assignment
          </Button>
        ) : null}
      </div>
      {campaignId ? (
        <BackfillAssignmentsWizard
          campaignId={campaignId}
          open={backfillOpen}
          onOpenChange={setBackfillOpen}
        />
      ) : null}
    </div>
  );
}
