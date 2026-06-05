"use client";

import { ClipboardListIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type AssignmentsEmptyStateProps = {
  onCreateAssignment?: () => void;
  createDisabled?: boolean;
};

export function AssignmentsEmptyState({
  onCreateAssignment,
  createDisabled = false,
}: AssignmentsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-14 text-center">
      <div className="flex size-11 items-center justify-center rounded-xl bg-muted/60">
        <ClipboardListIcon className="size-5 text-muted-foreground" />
      </div>
      <div className="max-w-md space-y-1.5">
        <p className="text-sm font-semibold text-foreground">No assignments yet</p>
        <p className="text-sm text-muted-foreground">
          Create an assignment to add a creator, deliverables, and posting schedule. Vendor IO
          and invoicing start only after you define assignments explicitly.
        </p>
      </div>
      {onCreateAssignment ? (
        <Button type="button" onClick={onCreateAssignment} disabled={createDisabled}>
          <PlusIcon data-icon="inline-start" />
          Create assignment
        </Button>
      ) : null}
    </div>
  );
}
