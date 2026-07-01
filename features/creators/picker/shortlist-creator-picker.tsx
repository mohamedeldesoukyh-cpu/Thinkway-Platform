"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import {
  addUnifiedCreatorsToShortlist,
  describeAddOutcome,
  isAddableCreator,
} from "@/features/discovery/shortlists/add-to-shortlist-client";

import {
  CreatorPickerDialog,
  existingKeysFromShortlistItems,
} from "./creator-picker-dialog";
import type { ExistingCreatorKey } from "./creator-selection-types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortlistId: string;
  existingItems: ExistingCreatorKey[];
  onAdded: () => void;
};

export function ShortlistCreatorPicker({
  open,
  onOpenChange,
  shortlistId,
  existingItems,
  onAdded,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const existingKeys = existingKeysFromShortlistItems(existingItems);

  function handleConfirm(
    creators: Parameters<typeof addUnifiedCreatorsToShortlist>[1]
  ) {
    if (creators.length === 0) {
      toast.error("Select at least one creator.");
      return;
    }
    startTransition(async () => {
      try {
        const outcome = await addUnifiedCreatorsToShortlist(shortlistId, creators);
        if (outcome.added > 0) {
          toast.success(describeAddOutcome(outcome));
        } else if (outcome.failed > 0) {
          toast.error(outcome.firstError ?? "Failed to add creators");
        } else {
          toast.info(describeAddOutcome(outcome));
        }
        onAdded();
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add creators");
      }
    });
  }

  return (
    <CreatorPickerDialog
      open={open}
      onOpenChange={onOpenChange}
      container="sheet"
      panelLayout
      title="Add creators"
      description="Search internal, imported, and discovered creators, then add them to this shortlist. Keep adding without losing your place."
      selectionMode="multi"
      productionOnly
      existingKeys={existingKeys}
      isRowDisabled={(creator) => !isAddableCreator(creator)}
      onConfirm={handleConfirm}
      onConfirmPending={isPending}
    />
  );
}
